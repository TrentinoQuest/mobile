import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, tap } from 'rxjs/operators';
import { EMPTY, Observable } from 'rxjs';
import { QuestRepository, QuestSearchFilter } from './repository/quest.repository';
import {
  AnyQuest,
  CheckInRequest,
  CheckInResponse,
  Completion,
  CompletionEntry,
  derivePlayerStatus,
  PlayerQuestStatus,
  PrimaryQuest,
  QuestType,
  ScanQrRequest,
  ScanQrResponse,
  SecondaryQuest,
} from './quest.types';

/**
 * QuestService — facade reattiva sopra il QuestRepository.
 *
 * Pattern: Service Layer.
 * Espone signal Angular per il consumo reattivo dalla UI. Le chiamate
 * al repository restano Observable internamente.
 *
 * Allineamento OpenAPI v0.2.0:
 * Le API riflettono gli endpoint REST veri. Niente "zones" — le zone
 * sono PrimaryQuest. Lo stato "discovered/available/locked" e' una
 * vista client-side derivata da AnyQuest + Completion[].
 *
 * Persistenza tra navigazioni:
 * I metodi loadQuests() e loadCompletions() saltano la chiamata se i
 * dati sono gia' stati caricati con successo (flag _initialized).
 * Per forzare un reload (es. pull-to-refresh), passare force=true.
 *
 * Gestione errori:
 * Errori HTTP del backend mappati a messaggi user-friendly. I codici
 * applicativi (es. QUEST_ALREADY_COMPLETED) hanno priorita' sul testo
 * generico HTTP status.
 *
 * Lifecycle:
 * providedIn: 'root' — singleton applicazione, sopravvive a navigation.
 */
@Injectable({ providedIn: 'root' })
export class QuestService {
  private readonly repository = inject(QuestRepository);

  // ----------------------------------------------------------------
  // Stato interno (signal privati)
  // ----------------------------------------------------------------

  private readonly _quests = signal<AnyQuest[]>([]);
  private readonly _completions = signal<Completion[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Flag di "caricamento avvenuto almeno una volta con successo".
  // Usati per skip dei reload non necessari su navigazione (vedi R2).
  private _questsInitialized = false;
  private _completionsInitialized = false;

  // ----------------------------------------------------------------
  // API pubblica reattiva (signal readonly)
  // ----------------------------------------------------------------

  /** Quest caricate dall'API (mix di primary e secondary). */
  readonly quests = this._quests.asReadonly();

  /** Completamenti del giocatore corrente. */
  readonly completions = this._completions.asReadonly();

  /** True quando una chiamata e' in corso. */
  readonly loading = this._loading.asReadonly();

  /** Messaggio di errore corrente, null se nessun errore. */
  readonly error = this._error.asReadonly();

  /**
   * Computed: quante quest sono state completate (= numero di completions
   * che riferiscono a una quest attualmente caricata).
   */
  readonly discoveredCount = computed(() => {
    const completedQuestIds = new Set(this._completions().map((c) => c.questId));
    return this._quests().filter((q) => completedQuestIds.has(q.id)).length;
  });

  /** Computed: numero totale di quest caricate (per il "12 / 47"). */
  readonly totalCount = computed(() => this._quests().length);

  /** Computed: solo le primary quest (per render come cerchi sulla mappa). */
  readonly primaryQuests = computed<PrimaryQuest[]>(() =>
    this._quests().filter(
      (q): q is PrimaryQuest => q.type === QuestType.PRIMARY,
    ),
  );

  /** Computed: solo le secondary quest (per render come marker puntuali). */
  readonly secondaryQuests = computed<SecondaryQuest[]>(() =>
    this._quests().filter(
      (q): q is SecondaryQuest => q.type === QuestType.SECONDARY,
    ),
  );

  // ----------------------------------------------------------------
  // Metodi pubblici (azioni)
  // ----------------------------------------------------------------

  /**
   * Carica le quest visibili sul territorio.
   *
   * Skip se gia' inizializzato (vedi R2 persistenza). Per forzare il
   * reload — es. pull-to-refresh o cambio bounds in mappa — passare
   * force=true.
   *
   * @param filter filtro geografico/tipo
   * @param force se true, esegue la chiamata anche se gia' inizializzato
   */
  loadQuests(filter?: QuestSearchFilter, force = false): void {
    if (this._questsInitialized && !force) return;

    this._loading.set(true);
    this._error.set(null);

    this.repository
      .getQuests(filter)
      .pipe(
        tap((quests) => {
          this._quests.set(quests);
          this._questsInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento quest'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  /**
   * Carica i completamenti del giocatore corrente.
   * Skip se gia' inizializzato. Passare force=true per refresh esplicito.
   */
  loadCompletions(limit = 100, offset = 0, force = false): void {
    if (this._completionsInitialized && !force) return;

    this._loading.set(true);
    this._error.set(null);

    this.repository
      .getCompletions(limit, offset)
      .pipe(
        tap((entries: CompletionEntry[]) => {
          this._completions.set(entries.map((e) => e.completion));
          this._completionsInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento completamenti'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  /**
   * Completa una quest secondaria via check-in geolocalizzato.
   *
   * @param questId ID della quest
   * @param body posizione GPS corrente
   * @returns Observable della response (per gestire toast/animazioni)
   */
  checkIn(questId: string, body: CheckInRequest): Observable<CheckInResponse> {
    return this.repository.checkIn(questId, body).pipe(
      tap((response) => {
        // Aggiungi il nuovo completion al signal: la UI reagisce automaticamente.
        this._completions.update((current) => [...current, response.completion]);
      }),
    );
  }

  /**
   * Completa una quest principale via scansione QR.
   *
   * @param questId ID della quest
   * @param body token QR + posizione GPS
   * @returns Observable della response (include il collectible sbloccato)
   */
  scan(questId: string, body: ScanQrRequest): Observable<ScanQrResponse> {
    return this.repository.scan(questId, body).pipe(
      tap((response) => {
        this._completions.update((current) => [...current, response.completion]);
      }),
    );
  }

  /**
   * Restituisce lo stato della quest dal punto di vista del giocatore.
   *
   * NON e' un signal computed per ogni quest (sarebbe O(N) signal).
   * E' una funzione pura che legge i signal _quests e _completions ad
   * ogni chiamata. Da usare lazy (es. al render del marker), non in loop.
   *
   * @param questId ID della quest
   * @returns 'discovered' | 'available' | 'locked'
   */
  playerStatusOf(questId: string): PlayerQuestStatus {
    const quest = this._quests().find((q) => q.id === questId);
    if (!quest) return 'available'; // fallback safe se quest non trovata

    return derivePlayerStatus(quest, this._completions());
  }

  /**
   * Reset completo dello stato. Utile in logout o cambio utente.
   * Resetta anche i flag di inizializzazione cosi' i prossimi load
   * partono da zero.
   */
  reset(): void {
    this._quests.set([]);
    this._completions.set([]);
    this._loading.set(false);
    this._error.set(null);
    this._questsInitialized = false;
    this._completionsInitialized = false;
  }

  // ----------------------------------------------------------------
  // Error mapping (R1)
  // ----------------------------------------------------------------

  /**
   * Estrae un messaggio user-friendly da qualsiasi tipo di errore.
   *
   * Strategia:
   * 1. Se e' un HttpErrorResponse e il body contiene { code, message },
   *    usa il code per cercare un messaggio mappato in ERROR_CODE_MESSAGES.
   *    Fallback al message del body.
   * 2. Se e' un HttpErrorResponse senza code, usa il messaggio per status HTTP.
   * 3. Se e' un Error generico, usa il suo message.
   * 4. Altrimenti, messaggio generico col contesto.
   */
  private formatError(err: unknown, context: string): string {
    if (err instanceof HttpErrorResponse) {
      // Body strutturato dal backend (vedi schema Error in OpenAPI).
      const body = err.error as { code?: string; message?: string } | null;

      // Priorita' 1: codice applicativo mappato.
      if (body?.code && ERROR_CODE_MESSAGES[body.code]) {
        return ERROR_CODE_MESSAGES[body.code];
      }

      // Priorita' 2: messaggio dal backend (se presente e leggibile).
      if (body?.message) {
        return body.message;
      }

      // Priorita' 3: messaggio per status HTTP.
      return this.messageForHttpStatus(err.status, context);
    }

    if (err instanceof Error) {
      return `Errore in ${context}: ${err.message}`;
    }

    return `Errore sconosciuto in ${context}`;
  }

  /** Mappa codice HTTP -> messaggio user-friendly. */
  private messageForHttpStatus(status: number, context: string): string {
    switch (status) {
      case 0:
        return 'Connessione assente. Verifica la tua rete.';
      case 400:
        return `Richiesta non valida (${context})`;
      case 401:
        return 'Sessione scaduta. Effettua di nuovo l\'accesso.';
      case 403:
        return 'Non hai i permessi per questa operazione.';
      case 404:
        return 'Risorsa non trovata.';
      case 409:
        return 'Operazione in conflitto con lo stato attuale.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Il server non risponde. Riprova tra qualche istante.';
      default:
        return `Errore di rete (${status}) in ${context}`;
    }
  }
}

// ============================================================================
// Mapping codici errore applicativi -> messaggi user-friendly
// ============================================================================
// Allineati ai codici esposti dal backend (vedi schema Error in OpenAPI).
// Aggiornare quando il backend introduce nuovi codici.

const ERROR_CODE_MESSAGES: Record<string, string> = {
  // --- Quest completion ---
  QUEST_ALREADY_COMPLETED: 'Hai gia\' scoperto questa quest.',
  QUEST_NOT_FOUND: 'Questa quest non esiste piu\'.',
  QUEST_INACTIVE: 'Questa quest non e\' attualmente disponibile.',

  // --- GPS / posizione ---
  OUT_OF_RANGE: 'Sei troppo lontano. Avvicinati al luogo della quest.',
  INVALID_POSITION: 'Posizione GPS non valida.',
  GPS_REQUIRED: 'Serve la tua posizione per completare questa quest.',

  // --- QR token ---
  INVALID_QR_TOKEN: 'Il QR scansionato non e\' valido per questa quest.',
  QR_EXPIRED: 'Il QR e\' scaduto o e\' stato sostituito.',

  // --- Auth ---
  TOKEN_EXPIRED: 'Sessione scaduta. Effettua di nuovo l\'accesso.',
  REFRESH_TOKEN_INVALID: 'Sessione non valida. Effettua di nuovo l\'accesso.',

  // --- Generic validation ---
  VALIDATION_ERROR: 'Dati non validi.',

  // TODO: estendere quando il backend espone nuovi codici.
};