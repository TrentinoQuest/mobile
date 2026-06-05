import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, tap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import type { LoreAnswerResponse, LoreQuestionView } from '@trentino-quest/shared-types';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/** Frammento di mappa salvato come promemoria in localStorage. */
export interface SavedFragment {
  questName: string;
  hint: string;
  savedAt: string;
}

/**
 * LoreQuizService — quiz della lore giornaliero (GDD "Sapere Territoriale").
 *
 * Endpoint:
 * - GET  /lore/daily-question
 * - POST /lore/answer  Body: { optionIndex }
 *
 * Un solo tentativo al giorno. In caso di risposta corretta accredita le
 * monete (AuthService.applyReward) e restituisce un frammento di mappa, che il
 * componente puo' salvare in localStorage (nessuna chiamata API, da GDD).
 */
@Injectable({ providedIn: 'root' })
export class LoreQuizService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Chiave localStorage dei frammenti di mappa salvati. */
  private static readonly KEY_FRAGMENTS = 'tq_lore_fragments';

  constructor() {
    inject(AuthService).logout$.subscribe(() => this.reset());
  }

  private readonly _question = signal<LoreQuestionView | null>(null);
  private readonly _answer = signal<LoreAnswerResponse | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  readonly question = this._question.asReadonly();
  readonly answer = this._answer.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** True se la domanda di oggi e' gia' stata affrontata (server o sessione). */
  readonly answered = computed(
    () => this._answer() !== null || (this._question()?.alreadyAnswered ?? false),
  );

  /** Indice dell'opzione corretta, da risposta corrente o risultato pregresso. */
  readonly correctIndex = computed<number | null>(() => {
    const a = this._answer();
    if (a) return a.correctOptionIndex;
    return this._question()?.result?.correctOptionIndex ?? null;
  });

  /** Spiegazione, da risposta corrente o risultato pregresso. */
  readonly explanation = computed<string | null>(() => {
    const a = this._answer();
    if (a) return a.explanation;
    return this._question()?.result?.explanation ?? null;
  });

  /** Carica la domanda del giorno. */
  load(force = false): void {
    if (this._initialized && !force) return;
    this._loading.set(true);
    this._error.set(null);
    this.http
      .get<LoreQuestionView>(`${environment.apiUrl}/lore/daily-question`)
      .pipe(
        tap((data) => {
          this._question.set(data);
          this._initialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento quiz'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  /** Invia la risposta. Accredita le monete se corretta. */
  submit(optionIndex: number): void {
    if (this.answered()) return;
    this._error.set(null);
    this.http
      .post<LoreAnswerResponse>(`${environment.apiUrl}/lore/answer`, { optionIndex })
      .pipe(
        tap((res) => {
          this._answer.set(res);
          if (res.correct && res.coinsAwarded > 0) {
            this.auth.applyReward(0, res.coinsAwarded);
          }
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'invio risposta'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  /** Salva un frammento di mappa in localStorage (promemoria, no API). */
  saveFragment(questName: string, hint: string): void {
    const fragments = this.getFragments();
    if (fragments.some((f) => f.questName === questName && f.hint === hint)) return;
    fragments.unshift({ questName, hint, savedAt: new Date().toISOString() });
    localStorage.setItem(LoreQuizService.KEY_FRAGMENTS, JSON.stringify(fragments));
  }

  /** Frammenti di mappa salvati. */
  getFragments(): SavedFragment[] {
    try {
      const raw = localStorage.getItem(LoreQuizService.KEY_FRAGMENTS);
      return raw ? (JSON.parse(raw) as SavedFragment[]) : [];
    } catch {
      return [];
    }
  }

  reset(): void {
    this._question.set(null);
    this._answer.set(null);
    this._loading.set(false);
    this._error.set(null);
    this._initialized = false;
  }

  private formatError(err: unknown, context: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | null;
      if (body?.message) return body.message;
      return `Errore di rete in ${context}`;
    }
    if (err instanceof Error) return `Errore in ${context}: ${err.message}`;
    return `Errore sconosciuto in ${context}`;
  }
}
