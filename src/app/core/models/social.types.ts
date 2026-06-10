/**
 * View model condivisi del modulo social (amicizie).
 *
 * Non esistono ancora in @trentino-quest/shared-types: quando verranno
 * aggiunti li' questi alias andranno sostituiti con i re-export. Unica
 * copia per lega, social e coop (prima erano triplicati).
 */

/** Amico confermato, da GET /social/friends. */
export interface Friend {
  friendshipId: string;
  playerId: string;
  username: string;
}

/** Richiesta di amicizia ricevuta, da GET /social/friends/requests. */
export interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  username: string;
  createdAt: string;
}
