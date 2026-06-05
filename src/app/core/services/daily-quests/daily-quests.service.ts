import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, finalize, tap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { DailyQuestContext } from '@trentino-quest/shared-types';
import type { DailyQuestAssignmentView, DailyQuestItem } from '@trentino-quest/shared-types';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { GeolocationService } from '../geolocation/geolocation.service';

/**
 * Bounding box approssimativo del Trentino, per derivare il contesto delle
 * missioni dall'ultima posizione GPS nota.
 */
const TRENTINO_BOUNDS = { minLat: 45.67, maxLat: 47.1, minLng: 10.38, maxLng: 12.48 };

/**
 * DailyQuestsService — missioni giornaliere (GDD "Couch Loop").
 *
 * Endpoint:
 * - GET  /player/daily-quests?context=in_trentino|out_of_region
 * - POST /player/daily-quests/:type/complete
 *
 * Stato via signal (come PlayerProfileService), reset al logout. La riscossione
 * marca la missione come riscossa in locale e accredita XP/monete al player via
 * AuthService.applyReward, senza un roundtrip a /player/me.
 *
 * Semantica dello stato (allineata al CLAUDE.md):
 * - pending:    !completed                         → "da completare"
 * - claimable:  completed && completedAt === null  → mostra "Riscuoti"
 * - claimed:    completed && completedAt !== null  → "riscossa"
 */
@Injectable({ providedIn: 'root' })
export class DailyQuestsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly geo = inject(GeolocationService);

  constructor() {
    inject(AuthService).logout$.subscribe(() => this.reset());
  }

  private readonly _quests = signal<DailyQuestItem[]>([]);
  private readonly _date = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private _initialized = false;

  readonly quests = this._quests.asReadonly();
  readonly date = this._date.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Missioni non ancora completate (per il badge dell'entry point). */
  readonly pendingCount = computed(() => this._quests().filter((q) => !q.completed).length);

  /** Missioni completate ma non ancora riscosse. */
  readonly claimableCount = computed(
    () => this._quests().filter((q) => q.completed && q.completedAt === null).length,
  );

  /**
   * Carica le missioni del giorno. Il contesto (in_trentino/out_of_region) e'
   * derivato dall'ultima posizione GPS nota.
   */
  load(force = false): void {
    if (this._initialized && !force) return;
    this._loading.set(true);
    this._error.set(null);
    const params = new HttpParams().set('context', this.detectContext());
    this.http
      .get<DailyQuestAssignmentView>(`${environment.apiUrl}/player/daily-quests`, { params })
      .pipe(
        tap((data) => {
          this._quests.set(data.quests);
          this._date.set(data.date);
          this._initialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento missioni'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  /**
   * Riscuote la ricompensa di una missione completata.
   * Marca la missione come riscossa in locale e accredita XP/monete.
   */
  claim(quest: DailyQuestItem): void {
    if (!quest.completed || quest.completedAt !== null) return;
    this.http
      .post<void>(`${environment.apiUrl}/player/daily-quests/${quest.type}/complete`, {})
      .pipe(
        tap(() => {
          this._quests.update((list) =>
            list.map((q) =>
              q.type === quest.type ? { ...q, completedAt: new Date().toISOString() } : q,
            ),
          );
          this.auth.applyReward(quest.xpReward, quest.coinsReward);
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'riscossione missione'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  /** Deriva il contesto geografico dall'ultima posizione nota. */
  private detectContext(): DailyQuestContext {
    const pos = this.geo.position();
    if (!pos) return DailyQuestContext.OUT_OF_REGION;
    const inTrentino =
      pos.lat >= TRENTINO_BOUNDS.minLat &&
      pos.lat <= TRENTINO_BOUNDS.maxLat &&
      pos.lng >= TRENTINO_BOUNDS.minLng &&
      pos.lng <= TRENTINO_BOUNDS.maxLng;
    return inTrentino ? DailyQuestContext.IN_TRENTINO : DailyQuestContext.OUT_OF_REGION;
  }

  reset(): void {
    this._quests.set([]);
    this._date.set(null);
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
