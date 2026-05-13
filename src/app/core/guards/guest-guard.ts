import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { homePathForRole } from '../utils/role-routing';

/**
 * guestGuard — Protegge le rotte pubbliche che hanno senso solo per
 * utenti non autenticati.
 *
 * Applicato a:
 * - / (landing)
 * - /auth/login
 * - /auth/recover
 * - /giocatore/register
 * - /attivita/register
 *
 * Comportamento:
 * - Se l'utente NON e' autenticato: accesso consentito.
 * - Se l'utente E' autenticato: redirect alla home del proprio ruolo.
 *
 * Esempio: un Giocatore loggato che apre l'app sulla landing viene
 * automaticamente portato alla sua home, senza vedere "Iscriviti" o
 * "Accedi" che non sono pertinenti al suo stato.
 *
 * NOTA: il guard si fida del signal currentUser di AuthService, gia
 * caricato sincrono dall'appInitializer.
 */
export const guestGuard: CanActivateFn = (): true | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();

  // Non autenticato: accesso consentito
  if (!currentUser) {
    return true;
  }

  // Autenticato: redirect alla home del proprio ruolo
  return router.parseUrl(homePathForRole(currentUser.role));
};