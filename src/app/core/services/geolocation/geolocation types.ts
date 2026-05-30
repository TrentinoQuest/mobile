// src/app/core/services/geolocation/geolocation.types.ts
//
// Tipi pubblici del modulo Geolocation.
//
// Position estende GeoFix di shared-types: la stessa struttura usata nei
// payload anti-cheat lato backend (vedi UC-22.4 e UC-30 del Deliverable D1
// + commit "feat: server-side anti-cheat GPS fix validation").
// Questo garantisce che la nostra Position sia passabile come fix per i
// check-in/scan senza conversioni: const fix = pick(position, ['accuracy',
// 'clientTimestamp']).
//
// I restanti tipi (PermissionState, GeoStatus, GeoError, GeoErrorCode)
// sono solo client-side e non hanno controparte backend.

import type { GeoFix } from '@trentino-quest/shared-types';

// -----------------------------------------------------------------------------
// Posizione
// -----------------------------------------------------------------------------

/**
 * Posizione geografica dell'utente, snapshot a un istante preciso.
 *
 * Estende GeoFix di shared-types (lat + lng + accuracy + clientTimestamp).
 * Estendere invece di ridefinire i campi garantisce:
 *  - structural typing automatico verso GeoFix nei payload backend
 *  - un singolo posto da aggiornare se shared-types evolve
 *  - simmetria semantica tra client e server
 *
 * Per ora Position e GeoFix sono identici nei campi, ma teniamo i due
 * tipi distinti perche':
 *  - Position e' un concetto "stato corrente del device", potrebbe in
 *    futuro avere campi solo client (provider GPS/network, heading,
 *    speed)
 *  - GeoFix e' un concetto "payload API", evolve sotto controllo del
 *    contratto API
 */
export interface Position extends GeoFix {}

// -----------------------------------------------------------------------------
// Stato del permesso
// -----------------------------------------------------------------------------

/**
 * Stato attuale del permesso di geolocalizzazione.
 *
 * Quattro stati invece dei 3 di Capacitor: aggiungiamo 'unknown' per
 * rappresentare onestamente la finestra temporale tra l'avvio del service
 * e la prima checkPermissions(). Senza questo stato, gli effect() che
 * reagiscono al permission state si triggererebbero falsamente al boot.
 *
 * Transizioni tipiche:
 *   unknown ──checkPermissions()──> prompt | granted | denied
 *   prompt  ──requestPermission()──> granted | denied
 *   denied  ──openAppSettings() + ritorno app──> checkPermissions()──> ...
 */
export type PermissionState =
  | 'unknown' // service appena creato, non ha ancora interrogato l'OS
  | 'prompt' // OS non ha ancora chiesto all'utente; safe da invocare il prompt
  | 'granted' // utente ha concesso il permesso
  | 'denied'; // utente ha negato; richiede intervento manuale in impostazioni

// -----------------------------------------------------------------------------
// Stato operativo del service
// -----------------------------------------------------------------------------

/**
 * Stato runtime del service, indipendente dal permesso.
 *
 * Utile per la UI per distinguere "sto chiedendo il permesso" da
 * "sto aspettando il primo fix" da "tutto ok, sto ricevendo update".
 *
 *  idle        — nessuna operazione in corso (stato iniziale e post-stopWatching)
 *  requesting  — getCurrentPosition() o requestPermission() in corso, aspetto risposta
 *  watching    — watch attivo, sto ricevendo (o aspettando) fix periodici
 *  error       — ultima operazione fallita; vedi error() signal per dettagli
 */
export type GeoStatus = 'idle' | 'requesting' | 'watching' | 'error';

// -----------------------------------------------------------------------------
// Errori
// -----------------------------------------------------------------------------

/**
 * Codici di errore applicativi del modulo geolocation client.
 *
 * Stesso pattern dei codici di errore quest del backend
 * (QUEST_ALREADY_COMPLETED, OUT_OF_RANGE_ACCURACY, ecc.): la UI accende
 * comportamenti diversi in base al code, mai parsando message.
 *
 * Il mapping da errori nativi di Capacitor a questi codici avviene
 * dentro geolocation.repository.capacitor.ts.
 */
export type GeoErrorCode =
  /** L'utente ha esplicitamente negato il permesso. Serve azione manuale in impostazioni. */
  | 'PERMISSION_DENIED'

  /** Il permesso non e' mai stato chiesto. La UI dovrebbe invocare requestPermission(). */
  | 'PERMISSION_PROMPT'

  /** GPS spento, modalita' aereo, o segnale non disponibile (es. indoor profondo). */
  | 'POSITION_UNAVAILABLE'

  /** Il fix non e' arrivato entro il timeout configurato. */
  | 'TIMEOUT'

  /** Browser/device privo di API di geolocazione. Edge case (vecchi browser desktop). */
  | 'NOT_SUPPORTED'

  /** Errore non classificato. Fallback per evitare di nascondere bug. */
  | 'UNKNOWN';

/**
 * Errore tipizzato esposto dal service.
 *
 * code serve alla logica (decisioni UI, retry policies).
 * message e' gia' localizzato in italiano e pronto per la UI
 * (il mapping codice → messaggio vive nel service, vedi
 * geolocation.service.ts).
 * originalError e' opzionale, utile in dev per debug ma non
 * dovrebbe mai finire nella UI.
 */
export interface GeoError {
  code: GeoErrorCode;
  message: string;
  originalError?: unknown;
}
