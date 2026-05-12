import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth/auth.service';
import { environment } from '../../../environments/environment';

/**
 * refreshInterceptor — Gestisce il rinnovo automatico dell'access token.
 * (commenti come sopra, omessi qui per brevita)
 */

// Stato condiviso
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

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

      return handleUnauthorized(req, next, authService);
    }),
  );
};

function handleUnauthorized(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
) {
  if (!authService.getRefreshToken()) {
    return throwError(() => new Error('Unauthorized: no refresh token'));
  }

  if (isRefreshing) {
    return refreshTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((newToken) => next(cloneWithToken(req, newToken))),
    );
  }

  isRefreshing = true;
  refreshTokenSubject.next(null);

  return authService.refreshAccessToken().pipe(
    switchMap((response) => {
      isRefreshing = false;
      refreshTokenSubject.next(response.accessToken);
      return next(cloneWithToken(req, response.accessToken));
    }),
    catchError((refreshError: HttpErrorResponse) => {
      isRefreshing = false;
      refreshTokenSubject.next(null);

      if (refreshError.status === 401) {
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
