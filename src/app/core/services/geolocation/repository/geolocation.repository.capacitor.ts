// src/app/core/services/geolocation/repository/geolocation.repository.capacitor.ts
//
// Implementazione concreta della repository basata su @capacitor/geolocation.
//
// Funziona sia su device nativi (Android/iOS) sia su browser desktop:
// Capacitor su web fa fallback all'API W3C Geolocation. Stessa interfaccia,
// stessa logica di errori, comportamento equivalente.
//
// Config GPS scelta per supportare l'anti-cheat lato server:
//  - enableHighAccuracy: true → GPS satellitare, accuracy bassa
//  - timeout: 10s
//  - maximumAge: 5s (riusiamo fix recenti per non drenare batteria)

import { Injectable } from '@angular/core';
import { Geolocation, type Position as CapacitorPosition } from '@capacitor/geolocation';
import type { Position, PermissionState, GeoError, GeoErrorCode } from '../geolocation types';
import { GeolocationRepository, WatchCallback } from './geolocation.repository';

/**
 * Opzioni di acquisizione applicate a getCurrentPosition e watchPosition.
 *
 *  enableHighAccuracy: true
 *    Forza l'uso del GPS satellitare quando disponibile, anziche'
 *    accontentarsi di localizzazione wifi/cell-tower. Necessario
 *    per ottenere accuracy nei 5-20m richiesti dalla feature di
 *    check-in geolocalizzato (raggi quest 5-80m).
 *
 *  timeout: 10000
 *    Dopo 10 secondi senza fix, Capacitor invoca la callback con
 *    errore TIMEOUT. Sufficientemente generoso da gestire i cold
 *    start del GPS in zone con cielo coperto.
 *
 *  maximumAge: 5000
 *    Accetta fix gia' acquisiti negli ultimi 5 secondi senza
 *    rifare la misurazione. Risparmia batteria sul watch continuo.
 *    5s e' anche ben sotto la soglia STALE_FIX del backend (60s),
 *    quindi un fix riusato passa sempre la validazione anti-cheat.
 */
const POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 5000,
};

@Injectable({ providedIn: 'root' })
export class GeolocationRepositoryCapacitor extends GeolocationRepository {
  async checkPermissions(): Promise<PermissionState> {
    try {
      const status = await Geolocation.checkPermissions();
      return mapPermissionState(status.location);
    } catch (err) {
      // Su alcuni browser, checkPermissions non e' supportata.
      // Restituiamo 'unknown' per non bloccare il flow: il consumer
      // procedera' a requestPermissions, che funziona ovunque.
      console.warn('[Geolocation] checkPermissions fallita, fallback a unknown', err);
      return 'unknown';
    }
  }

  async requestPermissions(): Promise<PermissionState> {
    try {
      const status = await Geolocation.requestPermissions();
      return mapPermissionState(status.location);
    } catch (err) {
      throw mapError(err);
    }
  }

  async getCurrentPosition(): Promise<Position> {
    try {
      const cap = await Geolocation.getCurrentPosition(POSITION_OPTIONS);
      return mapPosition(cap);
    } catch (err) {
      throw mapError(err);
    }
  }

  async watchPosition(callback: WatchCallback): Promise<string> {
    // Capacitor watchPosition firma: (options, callback) => Promise<string>
    // La callback Capacitor ha la stessa shape della nostra
    // (position | null, error | null), ma con tipi nativi.
    const watchId = await Geolocation.watchPosition(POSITION_OPTIONS, (cap, err) => {
      if (err) {
        callback(null, mapError(err));
        return;
      }
      if (cap) {
        callback(mapPosition(cap), null);
      }
      // Se entrambi null, ignoriamo: edge case mai documentato ma
      // difensivo per non propagare callback senza dato utile.
    });

    return watchId;
  }

  async clearWatch(watchId: string): Promise<void> {
    try {
      await Geolocation.clearWatch({ id: watchId });
    } catch (err) {
      // Idempotenza richiesta dal contratto: errori su clearWatch
      // (es. id sconosciuto) non devono propagare.
      console.warn('[Geolocation] clearWatch fallita (probabilmente id gia\' rimosso)', err);
    }
  }
}

// -----------------------------------------------------------------------------
// Mapping nativi → dominio
// -----------------------------------------------------------------------------

/**
 * Converte una CapacitorPosition (che a sua volta espone le coords nello
 * stesso shape dell'API W3C) nella nostra Position di dominio.
 *
 * accuracy e timestamp sono entrambi nativamente presenti, basta proiettare.
 */
function mapPosition(cap: CapacitorPosition): Position {
  return {
    lat: cap.coords.latitude,
    lng: cap.coords.longitude,
    accuracy: cap.coords.accuracy,
    clientTimestamp: cap.timestamp,
  };
}

/**
 * Converte lo stato permesso Capacitor nel nostro enum.
 *
 * Capacitor PermissionState include 'prompt-with-rationale' (Android-only,
 * indica che l'utente ha gia' negato una volta e l'OS suggerisce di mostrare
 * un razionale prima di richiedere di nuovo). Lo trattiamo come 'prompt'
 * normale: la UX non distingue i due casi.
 */
function mapPermissionState(cap: string): PermissionState {
  switch (cap) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
    case 'prompt-with-rationale':
      return 'prompt';
    default:
      return 'unknown';
  }
}

/**
 * Converte un errore Capacitor/W3C in un GeoError tipizzato.
 *
 * I codici W3C GeolocationPositionError sono:
 *   1 = PERMISSION_DENIED
 *   2 = POSITION_UNAVAILABLE
 *   3 = TIMEOUT
 *
 * Capacitor su native usa stringhe come "Location services are not enabled"
 * o "User denied location permission". Quindi controlliamo sia code sia
 * message per essere robusti su entrambe le piattaforme.
 */
function mapError(err: unknown): GeoError {
  const code = extractErrorCode(err);
  return {
    code,
    message: messageForCode(code),
    originalError: err,
  };
}

function extractErrorCode(err: unknown): GeoErrorCode {
  if (!err || typeof err !== 'object') {
    return 'UNKNOWN';
  }

  const errObj = err as { code?: unknown; message?: unknown };
  const numericCode = typeof errObj.code === 'number' ? errObj.code : null;
  const messageStr =
    typeof errObj.message === 'string' ? errObj.message.toLowerCase() : '';

  // Codici numerici W3C (browser e Capacitor web fallback)
  if (numericCode === 1) return 'PERMISSION_DENIED';
  if (numericCode === 2) return 'POSITION_UNAVAILABLE';
  if (numericCode === 3) return 'TIMEOUT';

  // Fallback su parsing message per Capacitor native (Android/iOS)
  if (messageStr.includes('denied') || messageStr.includes('permission')) {
    return 'PERMISSION_DENIED';
  }
  if (messageStr.includes('timeout')) {
    return 'TIMEOUT';
  }
  if (
    messageStr.includes('unavailable') ||
    messageStr.includes('not enabled') ||
    messageStr.includes('disabled')
  ) {
    return 'POSITION_UNAVAILABLE';
  }
  if (messageStr.includes('not implemented') || messageStr.includes('not supported')) {
    return 'NOT_SUPPORTED';
  }

  return 'UNKNOWN';
}

/**
 * Messaggio user-friendly in italiano per ogni codice di errore.
 * La UI mostra direttamente questa stringa senza ulteriori traduzioni.
 */
function messageForCode(code: GeoErrorCode): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 'Permesso di geolocalizzazione negato. Attivalo nelle impostazioni del dispositivo per usare la mappa.';
    case 'PERMISSION_PROMPT':
      return 'Permesso di geolocalizzazione non ancora richiesto.';
    case 'POSITION_UNAVAILABLE':
      return 'Posizione non disponibile. Verifica che il GPS sia attivo e di non essere in modalita\' aereo.';
    case 'TIMEOUT':
      return 'Tempo scaduto durante l\'acquisizione della posizione. Riprova tra qualche secondo.';
    case 'NOT_SUPPORTED':
      return 'Geolocalizzazione non supportata su questo dispositivo.';
    case 'UNKNOWN':
      return 'Errore sconosciuto durante l\'acquisizione della posizione.';
  }
}