import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Subject, catchError, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';
import { environment } from '../../../environments/environment';

/**
 * refreshInterceptor — Gestisce il rinnovo automatico dell'access token.
 *
 * Su un 401 verso il backend (esclusi gli endpoint pubblici di /auth/*):
 * - Se non c'e' un refresh in corso, lo avvia. Successo: ritenta la
 *   richiesta originale col nuovo token. Fallimento: propaga l'errore
 *   (e fa logout se il refresh stesso e' stato rifiutato con 401).
 * - Se un refresh e' gia' in corso, la richiesta si accoda al suo esito:
 *   nuovo token → retry; errore → l'errore viene propagato anche alle
 *   richieste in coda (mai lasciate in attesa indefinita).
 */

// Stato condiviso: Subject del refresh in corso, o null se nessuno.
// Ogni refresh ha il proprio Subject cosi' un fallimento (error) non
// "brucia" lo stream per i refresh successivi.
let refreshInFlight$: Subject<string> | null = null;

const REFRESH_EXCLUDED_ENDPOINTS: readonly string[] = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/password-recovery',
];

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const shouldHandle =
        error.status === 401 &&
        req.url.startsWith(environment.apiUrl) &&
        !isExcludedEndpoint(req.url);

      if (!shouldHandle) {
        return throwError(() => error);
      }

      return handleUnauthorized(req, next, authService, error);
    }),
  );
};

function handleUnauthorized(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  originalError: HttpErrorResponse,
) {
  if (!authService.getRefreshToken()) {
    // Nessun refresh possibile: propaga l'errore HTTP originale cosi'
    // i chiamanti mantengono status/body per la gestione UI.
    return throwError(() => originalError);
  }

  if (refreshInFlight$) {
    // Refresh gia' in corso: accodati al suo esito. Se il refresh fallisce
    // il Subject emette error e anche questa richiesta fallisce (niente
    // attese infinite).
    return refreshInFlight$.pipe(
      take(1),
      switchMap((newToken) => next(cloneWithToken(req, newToken))),
    );
  }

  const inFlight = new Subject<string>();
  refreshInFlight$ = inFlight;

  return authService.refreshAccessToken().pipe(
    switchMap((response) => {
      refreshInFlight$ = null;
      inFlight.next(response.accessToken);
      inFlight.complete();
      return next(cloneWithToken(req, response.accessToken));
    }),
    catchError((refreshError: unknown) => {
      refreshInFlight$ = null;
      // Propaga il fallimento anche alle richieste accodate.
      inFlight.error(refreshError);

      if (refreshError instanceof HttpErrorResponse && refreshError.status === 401) {
        authService.logout();
      }

      return throwError(() => refreshError);
    }),
  );
}

function isExcludedEndpoint(url: string): boolean {
  return REFRESH_EXCLUDED_ENDPOINTS.some((endpoint) => url.endsWith(endpoint));
}

function cloneWithToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}
