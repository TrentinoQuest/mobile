import { UserRole } from '@trentino-quest/shared-types';

/**
 * Mappa il ruolo dell'utente alla sua rotta home nell'app mobile.
 *
 * Usato dai guard (auth, guest) per redirezionare gli utenti autenticati
 * alle pagine corrette in base al loro ruolo.
 *
 * Admin e maintenance non hanno una home nell'app mobile (usano backoffice
 * web e app dedicata rispettivamente). Per loro ritorniamo la landing come
 * fallback difensivo; in pratica il login li respinge gia con un toast
 * prima che si arrivi a navigare alle home.
 */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case UserRole.PLAYER:
      return '/giocatore/home';
    case UserRole.BUSINESS:
      return '/attivita/home';
    case UserRole.ADMIN:
    case UserRole.MAINTENANCE:
    default:
      return '/';
  }
}