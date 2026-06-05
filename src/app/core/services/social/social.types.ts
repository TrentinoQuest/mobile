/**
 * Tipi del modulo Social.
 *
 * Feed e kudos riusano i DTO ufficiali di @trentino-quest/shared-types
 * (FeedActivityItem, KudosRequest), ri-esportati qui per comodita' dei
 * componenti. I tipi per amici/richieste/suggerimenti/notifiche non sono
 * ancora presenti in shared-types: sono definiti localmente, allineati ai
 * campi descritti negli endpoint /social/* del CLAUDE.md.
 */
export type { FeedActivityItem, KudosRequest } from '@trentino-quest/shared-types';

/**
 * Amico accettato — GET /social/friends.
 * `socialScore` e `questCompletions` sono i due valori mostrati in lista
 * (CLAUDE.md). `friendshipId` serve per la rimozione (DELETE /social/friends/:id).
 */
export interface FriendView {
  friendshipId: string;
  playerId: string;
  username: string;
  socialScore: number;
  questCompletions: number;
}

/**
 * Richiesta di amicizia ricevuta in attesa — GET /social/friends/requests.
 * Si accetta/rifiuta via friendshipId.
 */
export interface FriendRequestView {
  friendshipId: string;
  requesterId: string;
  username: string;
  requestedAt: string;
}

/**
 * Suggerimento di amico — GET /social/suggestions.
 * Si aggiunge inviando una richiesta con il playerId come recipientId.
 */
export interface FriendSuggestionView {
  playerId: string;
  username: string;
  socialScore: number;
  questCompletions: number;
}

/**
 * Notifica in-app — GET /social/notifications.
 * Il conteggio delle non lette (`read === false`) alimenta il badge.
 */
export interface SocialNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
