// src/app/core/services/geolocation/geolocation.service.ts
//
// Service facade per la geolocalizzazione.
//
// Espone lo stato GPS via signal reattivi (position, error, status,
// permission) consumabili dai componenti Angular. Internamente
// gestisce un singolo watch sulla repository sottostante, con
// state machine esplicita e politica "chiedi permesso una sola volta".
//
// Avvio automatico nel constructor: alla prima injection del service
// parte il bootstrap (check permesso → start watch). Lo step 3.7
// (app.component) usera' provideAppInitializer per garantire
// l'istanziazione anche se nessun componente lo inietta subito.

import { Injectable, computed, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import type { GeoError, GeoStatus, PermissionState, Position } from './geolocation types';
import { GeolocationRepository } from './repository/geolocation.repository';

/**
 * Chiave Preferences per il flag "permesso GPS gia' chiesto una volta".
 * Coerente col naming pattern tq_* usato per i token auth.
 */
const PERMISSION_ASKED_KEY = 'tq_gps_permission_asked';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly repository = inject(GeolocationRepository);

  // -----------------------------------------------------------------------
  // Stato interno (WritableSignal, mai esposti direttamente)
  // -----------------------------------------------------------------------

  private readonly _position = signal<Position | null>(null);
  private readonly _error = signal<GeoError | null>(null);
  private readonly _status = signal<GeoStatus>('idle');
  private readonly _permission = signal<PermissionState>('unknown');

  /**
   * watchId dell'unico watch attivo, o null se nessun watch in corso.
   * Single-watch policy: se startWatching viene chiamato con watch gia'
   * attivo, la seconda chiamata e' ignorata (log warning).
   */
  private currentWatchId: string | null = null;

  // -----------------------------------------------------------------------
  // API pubblica reattiva (signal readonly)
  // -----------------------------------------------------------------------

  /**
   * Ultima posizione GPS ricevuta, null se mai ottenuta o se il watch
   * non e' ancora partito.
   *
   * I componenti la consumano come signal: const pos = gpsService.position()
   * Aggiornamenti automatici via Angular change detection.
   */
  readonly position = this._position.asReadonly();

  /**
   * Ultimo errore non recuperato. Si azzera automaticamente al primo
   * fix valido successivo. La UI puo' usarlo per mostrare banner /
   * toast contestuali.
   */
  readonly error = this._error.asReadonly();

  /**
   * Stato operativo del service. Vedi geolocation.types.ts per la
   * descrizione delle transizioni.
   */
  readonly status = this._status.asReadonly();

  /**
   * Stato attuale del permesso GPS. La UI lo legge per decidere
   * se mostrare il banner "Attiva GPS" (quando 'denied').
   */
  readonly permission = this._permission.asReadonly();

  /**
   * Computed convenience: true se il service ha un fix recente
   * utilizzabile. Utile per gating della UI (es. disabilitare
   * il bottone check-in finche' non abbiamo una posizione).
   */
  readonly hasPosition = computed(() => this._position() !== null);

  // -----------------------------------------------------------------------
  // Bootstrap automatico
  // -----------------------------------------------------------------------

  constructor() {
    // Avvio non bloccante. Il constructor non puo' essere async, ma vogliamo
    // che il service sia immediatamente disponibile per le injections.
    // La promise viene esplicitamente "scartata" con void per indicare
    // che l'esecuzione async e' intenzionale (e per silenziare i linter
    // che si lamenterebbero di "floating promise").
    void this.bootstrap();
  }

  /**
   * Bootstrap del service:
   *  1. Legge lo stato attuale del permesso dall'OS
   *  2. Decide se chiedere il prompt o saltarlo (in base al flag
   *     PERMISSION_ASKED_KEY in Preferences)
   *  3. Se permesso concesso, avvia il watch
   *  4. Se permesso negato, popola error() e lascia la UI gestire
   *     il caso (banner persistente, vedi Step 3.8)
   *
   * Idempotente: chiamabile piu' volte senza side effects negativi
   * (utile per retry manuale dalla UI se l'utente abilita il permesso
   * via impostazioni del device).
   */
  async bootstrap(): Promise<void> {
    this._status.set('requesting');

    try {
      const currentPermission = await this.repository.checkPermissions();
      this._permission.set(currentPermission);

      if (currentPermission === 'granted') {
        // Caso felice: permesso gia' concesso da sessione precedente.
        // Avviamo subito il watch.
        await this.startWatching();
        return;
      }

      if (currentPermission === 'denied') {
        // Permesso esplicitamente negato. Non riproviamo il prompt
        // (politica "una volta sola"). La UI mostrera' il banner CTA.
        this.setError({
          code: 'PERMISSION_DENIED',
          message:
            'Permesso GPS negato. Attivalo nelle impostazioni per usare la mappa.',
        });
        return;
      }

      // Caso 'prompt' o 'unknown': l'OS ci dice che possiamo chiedere.
      // Verifichiamo pero' il nostro flag: se abbiamo gia' chiesto in
      // passato (e l'utente magari ha negato, poi reso il permesso
      // 'prompt' di nuovo via reset OS), rispettiamo la decisione
      // utente storica.
      const alreadyAsked = await this.hasAlreadyAskedPermission();
      if (alreadyAsked) {
        this.setError({
          code: 'PERMISSION_DENIED',
          message:
            'Permesso GPS non concesso. Attivalo nelle impostazioni per usare la mappa.',
        });
        return;
      }

      // Mai chiesto: e' il momento di chiedere.
      await this.requestPermissionFlow();
    } catch (err) {
      // Errori inattesi (es. plugin non disponibile). Catchiamo per
      // non lasciare il service in stato 'requesting' permanente.
      this.setError({
        code: 'UNKNOWN',
        message: 'Errore durante l\'inizializzazione del GPS.',
        originalError: err,
      });
    }
  }

  /**
   * Richiede il permesso all'utente, aggiorna il flag persistente,
   * e in caso di successo avvia il watch.
   */
  private async requestPermissionFlow(): Promise<void> {
    const result = await this.repository.requestPermissions();
    this._permission.set(result);
    await this.markPermissionAsked();

    if (result === 'granted') {
      await this.startWatching();
    } else {
      this.setError({
        code: 'PERMISSION_DENIED',
        message:
          'Permesso GPS negato. Attivalo nelle impostazioni per usare la mappa.',
      });
    }
  }

  // -----------------------------------------------------------------------
  // Watch lifecycle
  // -----------------------------------------------------------------------

  /**
   * Avvia il watch sulla repository. Single-watch policy: se gia'
   * attivo, no-op con warning.
   *
   * Esposto come pubblico ma in pratica chiamato solo internamente
   * (bootstrap). Lo lasciamo accessibile per casi futuri tipo
   * "riavvia manualmente da bottone debug".
   */
  async startWatching(): Promise<void> {
    if (this.currentWatchId !== null) {
      console.warn('[GeolocationService] Watch gia\' attivo, ignoro startWatching');
      return;
    }

    this._status.set('watching');

    this.currentWatchId = await this.repository.watchPosition((position, error) => {
      if (error) {
        // Errore non terminale: aggiorniamo lo stato ma teniamo il
        // watch attivo. Il GPS potrebbe riprendersi da solo (es. utente
        // esce dall'indoor e riacquisisce satellite).
        this.setError(error);

        // Eccezione: PERMISSION_DENIED in mezzo a un watch e' anomalo
        // ma se accade fermiamo (l'utente ha revocato il permesso a
        // runtime, non lo recupereremo senza intervento).
        if (error.code === 'PERMISSION_DENIED') {
          this._permission.set('denied');
          void this.stopWatching();
        }
        return;
      }

      if (position) {
        // Fix valido: aggiorna posizione, azzera errori precedenti,
        // assicura stato 'watching' (in caso fossimo finiti in 'error').
        this._position.set(position);
        this._error.set(null);
        this._status.set('watching');
      }
    });
  }

  /**
   * Ferma il watch corrente, se attivo. Idempotente.
   * Usato dal lifecycle pause (Step 3.7) e da eventuali test.
   */
  async stopWatching(): Promise<void> {
    if (this.currentWatchId === null) {
      return;
    }

    const idToClear = this.currentWatchId;
    this.currentWatchId = null;
    this._status.set('idle');

    await this.repository.clearWatch(idToClear);
  }

  // -----------------------------------------------------------------------
  // Persistenza flag "permission asked"
  // -----------------------------------------------------------------------

  private async hasAlreadyAskedPermission(): Promise<boolean> {
    const { value } = await Preferences.get({ key: PERMISSION_ASKED_KEY });
    return value === 'true';
  }

  private async markPermissionAsked(): Promise<void> {
    await Preferences.set({ key: PERMISSION_ASKED_KEY, value: 'true' });
  }

  // -----------------------------------------------------------------------
  // Helper interno
  // -----------------------------------------------------------------------

  /**
   * Aggiorna error() e porta status() a 'error'. Usato in ogni punto
   * di fail del bootstrap o del watch, per evitare duplicazione.
   */
  private setError(error: GeoError): void {
    this._error.set(error);
    this._status.set('error');
  }
}