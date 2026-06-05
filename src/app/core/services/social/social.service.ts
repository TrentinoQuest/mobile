import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, tap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import type { FeedActivityItem, KudosRequest } from '@trentino-quest/shared-types';
import { SocialRepository } from './repository/social.repository';
import type {
  FriendRequestView,
  FriendSuggestionView,
  FriendView,
  SocialNotification,
} from './social.types';
import { AuthService } from '../auth/auth.service';

/**
 * SocialService — stato e azioni del modulo social.
 *
 * Sostituisce i vecchi dati mockati con chiamate reali agli endpoint
 * /social/* via SocialRepository. Stile identico a PlayerProfileService:
 * signal privati esposti readonly, flag di inizializzazione per evitare
 * ricariche inutili, reset al logout e formatError centralizzato.
 *
 * Le azioni (kudos, accetta/rifiuta richiesta, rimuovi amico, aggiungi)
 * aggiornano lo stato locale in modo ottimistico, senza reload (CLAUDE.md).
 */
@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly repository = inject(SocialRepository);

  constructor() {
    inject(AuthService).logout$.subscribe(() => this.reset());
  }

  // -- Stato ------------------------------------------------------------

  private readonly _feed = signal<FeedActivityItem[]>([]);
  private readonly _friends = signal<FriendView[]>([]);
  private readonly _requests = signal<FriendRequestView[]>([]);
  private readonly _suggestions = signal<FriendSuggestionView[]>([]);
  private readonly _notifications = signal<SocialNotification[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private _feedInitialized = false;
  private _friendsInitialized = false;
  private _requestsInitialized = false;
  private _suggestionsInitialized = false;
  private _notificationsInitialized = false;

  readonly feed = this._feed.asReadonly();
  readonly friends = this._friends.asReadonly();
  readonly requests = this._requests.asReadonly();
  readonly suggestions = this._suggestions.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly friendCount = computed(() => this._friends().length);
  readonly requestCount = computed(() => this._requests().length);
  readonly unreadNotifications = computed(
    () => this._notifications().filter((n) => !n.read).length,
  );

  // -- Caricamenti ------------------------------------------------------

  loadFeed(force = false): void {
    if (this._feedInitialized && !force) return;
    this._loading.set(true);
    this._error.set(null);
    this.repository
      .getFeed()
      .pipe(
        tap((data) => {
          this._feed.set(data);
          this._feedInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento feed'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  loadFriends(force = false): void {
    if (this._friendsInitialized && !force) return;
    this._loading.set(true);
    this._error.set(null);
    this.repository
      .getFriends()
      .pipe(
        tap((data) => {
          this._friends.set(data);
          this._friendsInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento amici'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  loadRequests(force = false): void {
    if (this._requestsInitialized && !force) return;
    this._error.set(null);
    this.repository
      .getRequests()
      .pipe(
        tap((data) => {
          this._requests.set(data);
          this._requestsInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento richieste'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  loadSuggestions(force = false): void {
    if (this._suggestionsInitialized && !force) return;
    this._error.set(null);
    this.repository
      .getSuggestions()
      .pipe(
        tap((data) => {
          this._suggestions.set(data);
          this._suggestionsInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento suggerimenti'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  loadNotifications(force = false): void {
    if (this._notificationsInitialized && !force) return;
    this._error.set(null);
    this.repository
      .getNotifications()
      .pipe(
        tap((data) => {
          this._notifications.set(data);
          this._notificationsInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento notifiche'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  // -- Azioni -----------------------------------------------------------

  /**
   * Invia un kudos a un'attivita' del feed e marca myKudos = true in locale
   * senza reload. Se la chiamata fallisce, ripristina lo stato precedente.
   */
  sendKudos(activity: FeedActivityItem, emoji: KudosRequest['emoji']): void {
    if (activity.myKudos) return;
    const body: KudosRequest = {
      toPlayerId: activity.playerId,
      activityType: activity.type,
      activityId: activity.activityId,
      emoji,
    };
    this.patchActivity(activity.activityId, {
      myKudos: true,
      kudosCount: activity.kudosCount + 1,
    });
    this.repository
      .sendKudos(body)
      .pipe(
        catchError((err) => {
          // Rollback ottimistico in caso di errore.
          this.patchActivity(activity.activityId, {
            myKudos: false,
            kudosCount: activity.kudosCount,
          });
          this._error.set(this.formatError(err, 'invio kudos'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  /** Accetta una richiesta e la rimuove dalla lista locale. */
  acceptRequest(request: FriendRequestView): void {
    this.repository
      .acceptRequest(request.friendshipId)
      .pipe(
        tap(() => {
          this.removeRequestLocally(request.friendshipId);
          // La lista amici andra' ricaricata alla prossima apertura.
          this._friendsInitialized = false;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'accettazione richiesta'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  /** Rifiuta una richiesta e la rimuove dalla lista locale. */
  rejectRequest(request: FriendRequestView): void {
    this.repository
      .rejectRequest(request.friendshipId)
      .pipe(
        tap(() => this.removeRequestLocally(request.friendshipId)),
        catchError((err) => {
          this._error.set(this.formatError(err, 'rifiuto richiesta'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  /** Rimuove un amico e lo toglie dalla lista locale. */
  removeFriend(friend: FriendView): void {
    this.repository
      .removeFriend(friend.friendshipId)
      .pipe(
        tap(() =>
          this._friends.update((list) =>
            list.filter((f) => f.friendshipId !== friend.friendshipId),
          ),
        ),
        catchError((err) => {
          this._error.set(this.formatError(err, 'rimozione amico'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  /**
   * Invia una richiesta a un suggerimento e lo toglie dalla lista locale.
   * Restituisce una Promise cosi' il componente puo' mostrare una snackbar
   * di conferma/errore.
   */
  async sendFriendRequest(suggestion: FriendSuggestionView): Promise<boolean> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.repository.sendFriendRequest(suggestion.playerId).subscribe({
          next: () => resolve(),
          error: (err) => reject(err),
        });
      });
      this._suggestions.update((list) => list.filter((s) => s.playerId !== suggestion.playerId));
      return true;
    } catch (err) {
      this._error.set(this.formatError(err, 'invio richiesta di amicizia'));
      return false;
    }
  }

  /**
   * Invia una richiesta di amicizia cercando per nickname.
   * Restituisce true se la richiesta e' stata accettata dal server.
   * NOTA: endpoint per username DA CONFERMARE (vedi SocialRepository).
   */
  async sendFriendRequestByUsername(username: string): Promise<boolean> {
    const trimmed = username.trim();
    if (!trimmed) return false;
    try {
      await new Promise<void>((resolve, reject) => {
        this.repository.sendFriendRequestByUsername(trimmed).subscribe({
          next: () => resolve(),
          error: (err) => reject(err),
        });
      });
      return true;
    } catch (err) {
      this._error.set(this.formatError(err, 'invio richiesta di amicizia'));
      return false;
    }
  }

  /** Segna una notifica come letta (locale + server). */
  markNotificationRead(notification: SocialNotification): void {
    if (notification.read) return;
    this._notifications.update((list) =>
      list.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );
    this.repository
      .markNotificationRead(notification.id)
      .pipe(
        catchError((err) => {
          this._error.set(this.formatError(err, 'aggiornamento notifica'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  /** Segna tutte le notifiche come lette (locale + server). */
  markAllNotificationsRead(): void {
    if (this.unreadNotifications() === 0) return;
    this._notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    this.repository
      .markAllNotificationsRead()
      .pipe(
        catchError((err) => {
          this._error.set(this.formatError(err, 'aggiornamento notifiche'));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  reset(): void {
    this._feed.set([]);
    this._friends.set([]);
    this._requests.set([]);
    this._suggestions.set([]);
    this._notifications.set([]);
    this._loading.set(false);
    this._error.set(null);
    this._feedInitialized = false;
    this._friendsInitialized = false;
    this._requestsInitialized = false;
    this._suggestionsInitialized = false;
    this._notificationsInitialized = false;
  }

  // -- Helper privati ---------------------------------------------------

  private patchActivity(activityId: string, patch: Partial<FeedActivityItem>): void {
    this._feed.update((list) =>
      list.map((a) => (a.activityId === activityId ? { ...a, ...patch } : a)),
    );
  }

  private removeRequestLocally(friendshipId: string): void {
    this._requests.update((list) => list.filter((r) => r.friendshipId !== friendshipId));
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
