import { Routes } from '@angular/router';

/**
 * Mappa di navigazione di Trentino Quest Mobile.
 *
 * Convenzioni:
 * - Tutte le pagine sono lazy-loaded via loadComponent per mantenere
 *   il bundle iniziale snello.
 * - Le rotte sono raggruppate per dominio funzionale, coerentemente
 *   con la separazione dei componenti del Deliverable D2:
 *     - /auth/*       -> rotte trasversali a tutti i ruoli (login, ...)
 *     - /giocatore/*  -> rotte specifiche del ruolo Giocatore
 *     - /attivita/*   -> rotte specifiche del ruolo Attivita Locale
 *
 * TODO: in una fase successiva, la rotta '' (landing) dovra essere
 * protetta da un guard che redirige gli utenti gia autenticati alla
 * home del loro ruolo (mappa per Giocatore, dashboard per Attivita).
 */
export const routes: Routes = [
  // Landing page (default)
  {
    path: '',
    loadComponent: () =>
      import('./features/common/landing/landing.page').then((m) => m.LandingPage),
  },

  // Auth — rotte trasversali a tutti i ruoli
  /*
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/common/auth/login/login.page').then((m) => m.LoginPage),
  },
  
  */

  // Giocatore
  {
    path: 'giocatore/register',
    loadComponent: () =>
      import('./features/giocatore/register-player/register-player.page').then(
        (m) => m.RegisterPlayerPage,
      ),
  },

  // Attivita Locale
  {
    path: 'attivita/register',
    loadComponent: () =>
      import('./features/attivita/register-business/register-business.page').then(
        (m) => m.RegisterBusinessPage,
      ),
  },

  // Wildcard: qualsiasi URL non riconosciuto torna alla landing
  {
    path: '**',
    redirectTo: '',
  },
];