import { Routes } from '@angular/router';

export const routes: Routes = [
  // Landing page (default)
  {
    path: '',
    loadComponent: () =>
      import('./features/common/landing/landing.page').then(
        (m) => m.LandingPage,
      ),
  },

  // Auth — rotte trasversali a tutti i ruoli
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/common/auth/login/login.page').then(
        (m) => m.LoginPage,
      ),
  },
  {
    path: 'auth/recover',
    loadComponent: () =>
      import('./features/common/auth/recover-password/recover-password.page').then(
        (m) => m.RecoverPasswordPage,
      ),
  },

  // Pagina di emergenza — backend non raggiungibile
  {
    path: 'offline',
    loadComponent: () =>
      import('./features/common/offline/offline.page').then(
        (m) => m.OfflinePage,
      ),
  },

  // Giocatore
  {
    path: 'giocatore/register',
    loadComponent: () =>
      import('./features/giocatore/register-player/register-player.page').then(
        (m) => m.RegisterPlayerPage,
      ),
  },
  {
    path: 'giocatore/home',
    loadComponent: () =>
      import('./features/giocatore/home/home.page').then(
        (m) => m.HomePage,
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
  {
    path: 'attivita/home',
    loadComponent: () =>
      import('./features/attivita/home/home.page').then(
        (m) => m.AttivitaHomePage,
      ),
  },

  // Wildcard
  {
    path: '**',
    redirectTo: '',
  },
];