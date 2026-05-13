import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, tap } from 'rxjs/operators';
import { EMPTY, Observable } from 'rxjs';
import { QuestRepository } from './repository/quest.repository';
import { GeoBounds, Quest, Zone } from './quest.types';

/**
 * QuestService — facade reattiva sopra il QuestRepository.
 *
 * Pattern: Service Layer.
 * Il componente HomePage non parla mai direttamente con il repository.
 * Inietta questo service, legge i signal pubblici, chiama i metodi
 * pubblici. Il service gestisce internamente:
 * - chiamate al repository (sincrone/asincrone)
 * - stato di loading
 * - stato di error
 * - aggiornamento reattivo dei dati
 *
 * Reattivita':
 * Espone i dati come signal Angular. La UI puo' fare binding diretto
 * (es. @if (questService.loading()) { ... }) senza subscribe manuali.
 * Le chiamate HTTP/mock restano Observable internamente per supportare
 * cancellazione, retry, etc.
 *
 * Stato di errore:
 * Su errore di rete o di parsing, l'errore non viene re-lanciato ma
 * salvato nel signal error(). La UI puo' decidere cosa mostrare. Per
 * propagare l'errore al chiamante (es. per toast), si puo' restituire
 * un Observable dal metodo (vedi markAsDiscovered()).
 *
 * Lifecycle:
 * providedIn: 'root' — singleton applicazione. Non viene distrutto e
 * sopravvive a navigation. Lo stato persiste tra navigazioni dell'utente,
 * il che e' desiderabile (le zone caricate non vanno ricaricate ogni volta
 * che si torna sulla home).
 */
@Injectable({ providedIn: 'root' })
export class QuestService {
  private readonly repository = inject(QuestRepository);

  // ----------------------------------------------------------------
  // Stato interno (signal privati)
  // ----------------------------------------------------------------

  private readonly _zones = signal<Zone[]>([]);
  private readonly _quests = signal<Quest[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // ----------------------------------------------------------------
  // API pubblica reattiva (signal readonly)
  // ----------------------------------------------------------------

  /** Zone caricate. Vuoto finche' loadZones() non e' stato chiamato. */
  readonly zones = this._zones.asReadonly();

  /** Quest caricate. Vuoto finche' loadQuests() non e' stato chiamato. */
  readonly quests = this._quests.asReadonly();

  /** True quando una chiamata e' in corso. */
  readonly loading = this._loading.asReadonly();

  /** Messaggio di errore corrente, null se nessun errore. */
  readonly error = this._error.asReadonly();

  /** Computed: quante quest sono gia' scoperte dal giocatore. */
  readonly discoveredCount = computed(
    () => this._quests().filter((q) => q.status === 'discovered').length,
  );

  /** Computed: numero totale di quest visibili (per il "12 / 47"). */
  readonly totalCount = computed(() => this._quests().length);

  // ----------------------------------------------------------------
  // Metodi pubblici (azioni)
  // ----------------------------------------------------------------

  /**
   * Carica tutte le zone della regione.
   * Idempotente: se le zone sono gia' caricate, ricarica comunque
   * (utile per pull-to-refresh futuro).
   */
  loadZones(): void {
    this._loading.set(true);
    this._error.set(null);

    this.repository
      .getZones()
      .pipe(
        tap((zones) => this._zones.set(zones)),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento zone'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  /**
   * Carica le quest visibili nel bounding box geografico fornito.
   * Se bounds e' omesso, carica tutte le quest (sconsigliato in produzione).
   *
   * @param bounds area visibile della mappa
   */
  loadQuests(bounds?: GeoBounds): void {
    this._loading.set(true);
    this._error.set(null);

    this.repository
      .getQuestsInBounds(bounds)
      .pipe(
        tap((quests) => this._quests.set(quests)),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento quest'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  /**
   * Marca una quest come scoperta (dopo scansione QR validata).
   * Aggiorna il signal _quests in modo che la UI reagisca immediatamente
   * senza richiedere un loadQuests() esplicito.
   *
   * @returns Observable della quest aggiornata. Il chiamante puo'
   *   sottoscriversi per mostrare toast/animazioni di completamento.
   */
  markAsDiscovered(questId: string): Observable<Quest> {
    return this.repository.markAsDiscovered(questId).pipe(
      tap((updatedQuest) => {
        // Aggiornamento ottimistico locale: sostituiamo la quest
        // nell'array _quests con la versione aggiornata, mantenendo
        // l'ordine. La UI reagisce immediatamente via signal.
        this._quests.update((current) =>
          current.map((q) => (q.id === updatedQuest.id ? updatedQuest : q)),
        );
      }),
    );
  }

  /**
   * Reset completo dello stato. Utile in logout o cambio utente.
   */
  reset(): void {
    this._zones.set([]);
    this._quests.set([]);
    this._loading.set(false);
    this._error.set(null);
  }

  // ----------------------------------------------------------------
  // Utility private
  // ----------------------------------------------------------------

  /** Estrae un messaggio leggibile da qualsiasi tipo di errore. */
  private formatError(err: unknown, context: string): string {
    if (err instanceof Error) {
      return `Errore in ${context}: ${err.message}`;
    }
    return `Errore sconosciuto in ${context}`;
  }
}