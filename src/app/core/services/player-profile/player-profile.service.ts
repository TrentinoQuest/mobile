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
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private _collectionInitialized = false;
  private _progressInitialized = false;

  readonly collection = this._collection.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly unlockedCount = computed(() => this._collection().length);
  readonly totalCount = computed(() => this._progress()?.totalQuests ?? 0);

  loadCollection(force = false): void {
    if (this._collectionInitialized && !force) return;
    this._loading.set(true);
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
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  loadProgress(zone?: string, force = false): void {
    if (this._progressInitialized && !force) return;
    this._loading.set(true);
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
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  reset(): void {
    this._collection.set([]);
    this._progress.set(null);
    this._loading.set(false);
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
