import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * errorInterceptor — Cattura errori di rete e naviga alla pagina /offline.
 *
 * Comportamento:
 * - Cattura gli errori di rete (status 0) verso il nostro backend.
 * - Naviga alla pagina /offline.
 * - Lascia propagare l'errore al chiamante (i componenti gestiscono la
 *   loro UI di conseguenza, anche se di solito l'utente sara gia su /offline).
 *
 * Esclusioni:
 * - Le chiamate verso /health non triggerano la navigazione, perche /health
 *   e' usato proprio dalla pagina /offline per verificare il ritorno online.
 * - Se siamo gia su /offline, non navighiamo di nuovo (evita re-render inutili).
 *
 * NOTA: questo interceptor gestisce solo errori "di rete" (status 0).
 * I 4xx e 5xx HTTP arrivano dal server raggiungibile e vengono lasciati
 * passare al chiamante o ad altri interceptor (es. refreshInterceptor per i 401).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isNetworkError = error.status === 0;
      const isOurBackend = req.url.startsWith(environment.apiUrl);
      const isHealthCheck = req.url === environment.healthCheckUrl;
      const isAlreadyOffline = router.url === '/offline';

      const shouldRedirect = isNetworkError && isOurBackend && !isHealthCheck && !isAlreadyOffline;

      if (shouldRedirect) {
        // Navigazione fire-and-forget: non aspettiamo il completamento.
        void router.navigate(['/offline']);
      }

      return throwError(() => error);
    }),
  );
};
