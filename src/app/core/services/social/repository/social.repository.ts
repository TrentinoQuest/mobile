import { Observable } from 'rxjs';
import type { FeedActivityItem, KudosRequest } from '@trentino-quest/shared-types';
import type {
  FriendRequestView,
  FriendSuggestionView,
  FriendView,
  SocialNotification,
} from '../social.types';

/**
 * SocialRepository — contratto astratto per l'accesso ai dati social.
 *
 * Pattern: Repository (identico a QuestRepository / PlayerProfileRepository).
 * Astrae la fonte dei dati: il SocialService dipende solo da questa
 * interfaccia, non sa se i dati arrivano da HTTP, mock o cache.
 *
 * Allineato agli endpoint /social/* descritti nel CLAUDE.md. I tipi di
 * feed e kudos provengono da @trentino-quest/shared-types; quelli per
 * amici/richieste/suggerimenti/notifiche sono definiti localmente in
 * social.types.ts (non ancora presenti in shared-types).
 *
 * E' una classe abstract (non interface) perche' Angular DI la usa come
 * token di injection.
 */
export abstract class SocialRepository {
  /**
   * Feed delle attivita' degli amici.
   * Endpoint: GET /social/feed?limit=&offset=
   */
  abstract getFeed(limit?: number, offset?: number): Observable<FeedActivityItem[]>;

  /**
   * Lista amici accettati.
   * Endpoint: GET /social/friends
   */
  abstract getFriends(): Observable<FriendView[]>;

  /**
   * Richieste di amicizia ricevute in attesa.
   * Endpoint: GET /social/friends/requests
   */
  abstract getRequests(): Observable<FriendRequestView[]>;

  /**
   * Suggerimenti di amici.
   * Endpoint: GET /social/suggestions?limit=
   */
  abstract getSuggestions(limit?: number): Observable<FriendSuggestionView[]>;

  /**
   * Invia una richiesta di amicizia.
   * Endpoint: POST /social/friends/request  Body: { recipientId }
   */
  abstract sendFriendRequest(recipientId: string): Observable<void>;

  /**
   * Accetta una richiesta ricevuta.
   * Endpoint: POST /social/friends/:friendshipId/accept
   */
  abstract acceptRequest(friendshipId: string): Observable<void>;

  /**
   * Rifiuta una richiesta ricevuta.
   * Endpoint: POST /social/friends/:friendshipId/reject
   */
  abstract rejectRequest(friendshipId: string): Observable<void>;

  /**
   * Rimuove un amico.
   * Endpoint: DELETE /social/friends/:friendshipId
   */
  abstract removeFriend(friendshipId: string): Observable<void>;

  /**
   * Invia un kudos a un'attivita' del feed.
   * Endpoint: POST /social/kudos
   */
  abstract sendKudos(body: KudosRequest): Observable<void>;

  /**
   * Notifiche in-app del giocatore.
   * Endpoint: GET /social/notifications
   */
  abstract getNotifications(): Observable<SocialNotification[]>;

  /**
   * Segna una singola notifica come letta.
   * Endpoint: PATCH /social/notifications/:id/read
   */
  abstract markNotificationRead(id: string): Observable<void>;

  /**
   * Segna tutte le notifiche come lette.
   * Endpoint: PATCH /social/notifications/read-all
   */
  abstract markAllNotificationsRead(): Observable<void>;
}
