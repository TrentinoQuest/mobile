// src/app/core/services/geolocation/repository/geolocation.repository.ts
//
// Contratto repository per l'accesso alla geolocalizzazione.
//
// Due implementazioni:
//  - GeolocationRepositoryMock: usata in dev/browser per simulare GPS
//    senza chiedere permessi, con jitter per testare reattivita'.
//  - GeolocationRepositoryCapacitor: wrapper su @capacitor/geolocation,
//    usata su device reali.
//
// La scelta tra le due avviene in main.ts via environment toggle.
//
// Stile API: callback + watchId, coerente con l'API Capacitor nativa.
// La conversione a signal reattivo Angular avviene nel service facade,
// non qui: la repository resta agnostica rispetto al framework.

import type { Position, PermissionState, GeoError } from '../geolocation types';

/**
 * Callback invocata a ogni nuovo fix GPS dal watch attivo.
 *
 * Pattern Node-style: uno dei due parametri e' sempre null.
 *  - Successo: callback(position, null)
 *  - Errore:   callback(null, error)
 *
 * La callback viene invocata ripetutamente per tutta la durata del
 * watch, finche' non viene chiamato clearWatch().
 */
export type WatchCallback = (position: Position | null, error: GeoError | null) => void;

/**
 * Contratto astratto per l'accesso alla geolocalizzazione del device.
 *
 * Le implementazioni concrete (mock per dev, capacitor per device)
 * forniscono la stessa interfaccia. Il service facade le consuma
 * indifferentemente tramite Angular DI.
 *
 * Tutti i metodi sono async per uniformita': anche dove un mock
 * potrebbe rispondere sincrono, mantenere Promise rende le firme
 * coerenti tra implementazioni e semplifica il service.
 */
export abstract class GeolocationRepository {
  /**
   * Controlla lo stato attuale del permesso senza chiederlo all'utente.
   *
   * Da chiamare al boot del service per popolare lo stato iniziale
   * (transizione 'unknown' → 'prompt' | 'granted' | 'denied').
   */
  abstract checkPermissions(): Promise<PermissionState>;

  /**
   * Richiede il permesso all'utente se non gia' concesso.
   *
   * Su device mostra il prompt di sistema. Se l'utente ha gia'
   * concesso, ritorna 'granted' senza prompt. Se ha gia' negato,
   * ritorna 'denied' senza chiedere di nuovo (l'utente deve andare
   * in impostazioni manualmente).
   */
  abstract requestPermissions(): Promise<PermissionState>;

  /**
   * Ottiene un singolo fix GPS one-shot.
   *
   * Usato per casi in cui non serve un watch continuo (es. validare
   * la posizione al momento di un check-in occasionale). Rifiutato
   * con GeoError se manca il permesso o il fix non arriva entro
   * il timeout.
   */
  abstract getCurrentPosition(): Promise<Position>;

  /**
   * Avvia un watch continuo che invoca callback a ogni nuovo fix.
   *
   * Ritorna un watchId opaco da passare a clearWatch() per fermare
   * il watch. La callback puo' essere invocata zero, una o N volte
   * a seconda della disponibilita' GPS e della durata del watch.
   *
   * Errori non terminano il watch automaticamente: la callback viene
   * invocata con error != null e il watch resta attivo, in attesa
   * del prossimo fix valido. E' responsabilita' del chiamante decidere
   * se fermare il watch in caso di errore persistente.
   */
  abstract watchPosition(callback: WatchCallback): Promise<string>;

  /**
   * Ferma un watch precedentemente avviato.
   *
   * Idempotente: chiamare clearWatch con un watchId gia' rimosso
   * o inesistente non lancia errore.
   */
  abstract clearWatch(watchId: string): Promise<void>;
}
