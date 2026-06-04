import { Routes } from '@angular/router';
import { UserRole } from '@trentino-quest/shared-types';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { businessStatusGuard } from './core/guards/business-status.guard';

/**
 * Mappa di navigazione di Trentino Quest Mobile.
 *
 * Convenzioni:
 * - Tutte le pagine sono lazy-loaded via loadComponent per mantenere
 *   il bundle iniziale snello.
 * - Le rotte sono raggruppate per dominio funzionale:
 *     - /auth/*       -> rotte trasversali a tutti i ruoli
 *     - /giocatore/*  -> rotte specifiche del ruolo Giocatore
 *     - /attivita/*   -> rotte specifiche del ruolo Attivita Locale
 *     - /offline      -> stato eccezionale (backend down)
 *
 * Guards:
 * - guestGuard: rotte pubbliche, redirezionano utenti autenticati alla
 *   home del loro ruolo.
 * - authGuard: rotte autenticate, con role-check via data.allowedRoles.
 *
 * Layout del giocatore:
 * Le 4 tab del giocatore (home, album, amici, profilo) sono figlie di un
 * unico GiocatoreLayoutComponent che monta la tab bar persistente in
 * basso e ha un <router-outlet> al centro. Questo evita che la tab bar
 * scompaia/riappaia ad ogni navigazione e mantiene lo stato della mappa
 * (zoom, posizione) coerente quando l'utente torna sulla home.
 *
 * La scansione QR NON e' una rotta: e' una modal lanciata dal pulsante
 * centrale della tab bar (tab "scan"). Pattern coerente con Pokemon GO,
 * Yuka, e simili scanner-driven apps.
 */
export const routes: Routes = [
  // ============================================================
  // Landing page (default, pubblica)
  // ============================================================
  {
    path: '',
    loadComponent: () =>
      import('./features/common/landing/landing.page').then((m) => m.LandingPage),
    canActivate: [guestGuard],
  },

  // ============================================================
  // Auth — rotte trasversali, pubbliche
  // ============================================================
  {
    path: 'auth/login',
    loadComponent: () => import('./features/common/auth/login/login.page').then((m) => m.LoginPage),
    canActivate: [guestGuard],
  },
  {
    path: 'auth/recover',
    loadComponent: () =>
      import('./features/common/auth/recover-password/recover-password.page').then(
        (m) => m.RecoverPasswordPage,
      ),
    canActivate: [guestGuard],
  },

  // ============================================================
  // Giocatore — registrazione (fuori dal layout shell, pubblica)
  // ============================================================
  {
    path: 'giocatore/register',
    loadComponent: () =>
      import('./features/giocatore/register-player/register-player.page').then(
        (m) => m.RegisterPlayerPage,
      ),
    canActivate: [guestGuard],
  },

  // ============================================================
  // Giocatore — sezione autenticata con layout shell + tab bar
  // ============================================================
  // Il layout protegge tutti i figli con authGuard + role-check.
  // Le rotte figlie non hanno bisogno di ridichiarare il guard.
  {
    path: 'giocatore',
    loadComponent: () =>
      import('./features/giocatore/layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    data: { allowedRoles: [UserRole.PLAYER] },
    children: [
      // Redirect del padre alla home di default
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      // Tab 1 — Mappa (home)
      {
        path: 'home',
        loadComponent: () => import('./features/giocatore/home/home.page').then((m) => m.HomePage),
      },
      // Tab 2 — Album / Collezione
      {
        path: 'album',
        loadComponent: () =>
          import('./features/giocatore/album/album.page').then((m) => m.AlbumPage),
      },
      // Tab 3 — Amici / Social
      {
        path: 'amici',
        loadComponent: () =>
          import('./features/giocatore/amici/amici.page').then((m) => m.AmiciPage),
      },
      // Tab 4 — Profilo
      {
        path: 'profilo',
        loadComponent: () =>
          import('./features/giocatore/profilo/profilo.page').then((m) => m.ProfiloPage),
      },
    ],
  },

  // ============================================================
  // Attivita Locale — registrazione (pubblica)
  // ============================================================
  {
    path: 'attivita/register',
    loadComponent: () =>
      import('./features/attivita/register-business/register-business.page').then(
        (m) => m.RegisterBusinessPage,
      ),
    canActivate: [guestGuard],
  },

  // ============================================================
  // Attivita Locale — sezione autenticata
  // Il padre protegge tutti i figli con authGuard + role-check.
  // businessStatusGuard è applicato singolarmente ai figli che
  // richiedono approvalStatus === 'approved'.
  // ============================================================
  {
    path: 'attivita',
    loadComponent: () =>
      import('./features/attivita/layout/layout.component').then((m) => m.AttivitaLayoutComponent),
    canActivate: [authGuard],
    data: { allowedRoles: [UserRole.BUSINESS] },
    children: [
      // Redirect del padre alla home di default
      { path: '', redirectTo: 'home', pathMatch: 'full' },

      // Pagine di stato (nessun businessStatusGuard: sono la destinazione del redirect)
      {
        path: 'pending',
        loadComponent: () =>
          import('./features/attivita/pending-approval/pending-approval.page').then(
            (m) => m.PendingApprovalPage,
          ),
      },
      {
        path: 'rejected',
        loadComponent: () =>
          import('./features/attivita/rejected/rejected.page').then((m) => m.RejectedPage),
      },

      // Pagine protette da businessStatusGuard (solo approved)
      {
        path: 'home',
        loadComponent: () =>
          import('./features/attivita/home/home.page').then((m) => m.AttivitaHomePage),
        canActivate: [businessStatusGuard],
      },
      {
        path: 'profilo',
        loadComponent: () =>
          import('./features/attivita/profilo/profilo.page').then((m) => m.AttivitaProfiloPage),
        canActivate: [businessStatusGuard],
      },
      {
        path: 'offerte',
        loadComponent: () =>
          import('./features/attivita/offerte/offerte.page').then((m) => m.OffertePage),
        canActivate: [businessStatusGuard],
      },
      {
        path: 'offerte/new',
        loadComponent: () =>
          import('./features/attivita/offerte/form/offer-form.page').then((m) => m.OfferFormPage),
        canActivate: [businessStatusGuard],
      },
      {
        path: 'offerte/:id',
        loadComponent: () =>
          import('./features/attivita/offerte/form/offer-form.page').then((m) => m.OfferFormPage),
        canActivate: [businessStatusGuard],
      },
    ],
  },

  // ============================================================
  // Offline — stato eccezionale, accessibile a tutti
  // ============================================================
  {
    path: 'offline',
    loadComponent: () =>
      import('./features/common/offline/offline.page').then((m) => m.OfflinePage),
  },

  // ============================================================
  // Wildcard: qualsiasi URL non riconosciuto torna alla landing
  // ============================================================
  {
    path: '**',
    redirectTo: '',
  },
];
