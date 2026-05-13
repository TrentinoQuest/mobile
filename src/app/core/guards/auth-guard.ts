import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { UserRole } from '@trentino-quest/shared-types';
import { AuthService } from '../services/auth/auth.service';
import { homePathForRole } from '../utils/role-routing';

/**
 * authGuard — Protegge le rotte autenticate.
 *
 * Verifica due condizioni in sequenza:
 * 1. L'utente e' autenticato. Se no, redirect a /auth/login.
 * 2. L'utente ha un ruolo consentito per questa rotta. Se no, redirect
 *    alla home del proprio ruolo (silenzioso, senza toast).
 *
 * I ruoli consentiti vengono letti da route.data.allowedRoles, che deve
 * essere un array di UserRole. Se data.allowedRoles non e' definito,
 * il guard accetta qualunque ruolo autenticato (rotta "any-authenticated").
 *
 * Esempio di rotta protetta:
 *   {
 *     path: 'giocatore/home',
 *     loadComponent: ...,
 *     canActivate: [authGuard],
 *     data: { allowedRoles: [UserRole.PLAYER] },
 *   }
 *
 * NOTA: il guard si fida del signal currentUser di AuthService, che e'
 * gia stato caricato sincrono dall'appInitializer prima del rendering.
 * Niente race condition.
 */
export const authGuard: CanActivateFn = (route): true | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();

  // 1. Non autenticato: redirect al login
  if (!currentUser) {
    return router.parseUrl('/auth/login');
  }

  // 2. Verifica role-check, se configurato
  const allowedRoles = route.data['allowedRoles'] as UserRole[] | undefined;

  // Se la rotta non specifica allowedRoles, accettiamo qualunque ruolo autenticato
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  // 3. Ruolo dell'utente non e' tra quelli consentiti: redirect alla sua home
  if (!allowedRoles.includes(currentUser.role)) {
    return router.parseUrl(homePathForRole(currentUser.role));
  }

  return true;
};


