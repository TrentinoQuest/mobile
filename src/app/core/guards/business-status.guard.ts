import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { BusinessService } from '../services/business/business.service';
import { BusinessApprovalStatus } from '../services/business/business.types';

/**
 * businessStatusGuard — Controlla lo stato di approvazione dell'attività.
 *
 * Usato sulle rotte /attivita/home, /attivita/profilo, /attivita/offerte.
 * NON applicato a /attivita/pending e /attivita/rejected (evitare loop redirect).
 *
 * Logica:
 * - Se il profilo è già in memoria: decide subito (sincrono).
 * - Se non è ancora caricato: chiama ensureProfile() poi decide.
 * - pending  → redirect a /attivita/pending
 * - rejected → redirect a /attivita/rejected
 * - approved → lascia passare (true)
 *
 * In caso di errore HTTP (es. token scaduto): redirect a /attivita/pending
 * come fallback difensivo (l'authGuard a monte gestisce già il 401).
 */
export const businessStatusGuard: CanActivateFn = (): Observable<boolean | UrlTree> | boolean | UrlTree => {
  const businessService = inject(BusinessService);
  const router = inject(Router);

  const profile = businessService.profile();

  // Profilo già in memoria: risposta sincrona
  if (profile) {
    return redirectByStatus(profile.approvalStatus, router);
  }

  // Profilo non ancora caricato: fetch asincrono
  return businessService.ensureProfile().pipe(
    map((fetched) => redirectByStatus(fetched.approvalStatus, router)),
    catchError(() => of(router.parseUrl('/attivita/pending'))),
  );
};

function redirectByStatus(status: BusinessApprovalStatus, router: Router): boolean | UrlTree {
  if (status === 'pending') return router.parseUrl('/attivita/pending');
  if (status === 'rejected') return router.parseUrl('/attivita/rejected');
  return true;
}
