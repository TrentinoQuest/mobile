import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { FeedActivityItem, KudosRequest } from '@trentino-quest/shared-types';
import { SocialRepository } from './social.repository';
import type {
  FriendRequestView,
  FriendSuggestionView,
  FriendView,
  SocialNotification,
} from '../social.types';
import { environment } from '../../../../../environments/environment';

/**
 * HttpSocialRepository — implementazione REST del contratto SocialRepository.
 *
 * Mappa 1:1 gli endpoint /social/* del CLAUDE.md. L'authInterceptor gia'
 * configurato in main.ts attacca il Bearer token: niente da gestire qui.
 * Gli errori HTTP si propagano come HttpErrorResponse; il SocialService li
 * intercetta con catchError() e li converte in messaggi user-friendly.
 */
@Injectable()
export class HttpSocialRepository extends SocialRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  override getFeed(limit = 20, offset = 0): Observable<FeedActivityItem[]> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<FeedActivityItem[]>(`${this.apiUrl}/social/feed`, { params });
  }

  override getFriends(): Observable<FriendView[]> {
    return this.http.get<FriendView[]>(`${this.apiUrl}/social/friends`);
  }

  override getRequests(): Observable<FriendRequestView[]> {
    return this.http.get<FriendRequestView[]>(`${this.apiUrl}/social/friends/requests`);
  }

  override getSuggestions(limit = 10): Observable<FriendSuggestionView[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<FriendSuggestionView[]>(`${this.apiUrl}/social/suggestions`, { params });
  }

  override sendFriendRequest(recipientId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/social/friends/request`, { recipientId });
  }

  override acceptRequest(friendshipId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/social/friends/${friendshipId}/accept`, {});
  }

  override rejectRequest(friendshipId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/social/friends/${friendshipId}/reject`, {});
  }

  override removeFriend(friendshipId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/social/friends/${friendshipId}`);
  }

  override sendKudos(body: KudosRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/social/kudos`, body);
  }

  override getNotifications(): Observable<SocialNotification[]> {
    return this.http.get<SocialNotification[]>(`${this.apiUrl}/social/notifications`);
  }

  override markNotificationRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/social/notifications/${id}/read`, {});
  }

  override markAllNotificationsRead(): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/social/notifications/read-all`, {});
  }
}
