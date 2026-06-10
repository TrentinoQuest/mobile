import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, tap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { PlayerProfileRepository } from './repository/player-profile.repository';
import type { CollectibleEntry, ProgressSummary } from './player-profile.types';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class PlayerProfileService {
  private readonly repository = inject(PlayerProfileRepository);

  constructor() {
    inject(AuthService).logout$.subscribe(() => this.reset());
  }

  private readonly _collection = signal<CollectibleEntry[]>([]);
  private readonly _progress = signal<ProgressSummary | null>(null);
  // Loading separati: collezione e progressi vengono caricati in parallelo,
  // un finalize non deve spegnere lo spinner dell'altra chiamata.
  private readonly _collectionLoading = signal(false);
  private readonly _progressLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  private _collectionInitialized = false;
  private _progressInitialized = false;

  readonly collection = this._collection.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly loading = computed(() => this._collectionLoading() || this._progressLoading());
  readonly error = this._error.asReadonly();

  readonly unlockedCount = computed(() => this._collection().length);
  readonly totalCount = computed(() => this._progress()?.totalQuests ?? 0);

  loadCollection(force = false): void {
    if (this._collectionInitialized && !force) return;
    this._collectionLoading.set(true);
    this._error.set(null);
    this.repository
      .getCollection()
      .pipe(
        tap((data) => {
          this._collection.set(data);
          this._collectionInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento collezione'));
          return EMPTY;
        }),
        finalize(() => this._collectionLoading.set(false)),
      )
      .subscribe();
  }

  loadProgress(zone?: string, force = false): void {
    if (this._progressInitialized && !force) return;
    this._progressLoading.set(true);
    this._error.set(null);
    this.repository
      .getProgress(zone)
      .pipe(
        tap((data) => {
          this._progress.set(data);
          this._progressInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento progressi'));
          return EMPTY;
        }),
        finalize(() => this._progressLoading.set(false)),
      )
      .subscribe();
  }

  reset(): void {
    this._collection.set([]);
    this._progress.set(null);
    this._collectionLoading.set(false);
    this._progressLoading.set(false);
    this._error.set(null);
    this._collectionInitialized = false;
    this._progressInitialized = false;
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
