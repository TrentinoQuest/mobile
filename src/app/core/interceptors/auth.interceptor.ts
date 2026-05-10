import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth/auth.service';
import { environment } from '../../../environments/environment';

/**
 * authInterceptor — Allega l'access token alle richieste API protette.
 *
 * Comportamento:
 * - Se la richiesta NON va verso environment.apiUrl, passa invariata.
 * - Se la richiesta va verso un endpoint pubblico (login, register, refresh,
 *   password-recovery), passa invariata.
 * - Altrimenti, se c'e un access token disponibile, allega l'header
 *   "Authorization: Bearer <token>".
 * - Se non c'e un access token, lascia passare la richiesta senza header.
 *   Il backend rispondera 401 e il refreshInterceptor gestira il caso.
 *
 * NOTA: l'interceptor NON tenta refresh proattivo del token. Quella logica
 * vive nel refreshInterceptor, che reagisce ai 401.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // 1. Solo le richieste verso il nostro backend devono ricevere il token
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  // 2. Gli endpoint pubblici non devono ricevere il token
  if (isPublicEndpoint(req.url)) {
    return next(req);
  }

  // 3. Recupera l'access token. Se manca, lascia passare senza header.
  const accessToken = authService.getAccessToken();
  if (!accessToken) {
    return next(req);
  }

  // 4. Clona la richiesta aggiungendo l'header Authorization
  const authenticatedReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return next(authenticatedReq);
};

/**
 * Lista degli endpoint pubblici che NON richiedono Authorization.
 * Sono i quattro endpoint di /auth/* che operano in assenza di sessione.
 */
const PUBLIC_ENDPOINTS: readonly string[] = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/password-recovery',
];

/**
 * Verifica se l'URL della richiesta corrisponde a un endpoint pubblico.
 * Usa endsWith per non dipendere dal prefisso completo dell'apiUrl.
 */
function isPublicEndpoint(url: string): boolean {
  return PUBLIC_ENDPOINTS.some((endpoint) => url.endsWith(endpoint));
}