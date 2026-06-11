import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from '../services/auth/auth.service';
import { homePathForRole } from '../utils/role-routing';

// Protegge /onboarding: accessibile solo se onboardingDone è false E utente non autenticato
export const onboardingGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();
  if (currentUser) {
    return router.parseUrl(homePathForRole(currentUser.role));
  }

  const { value } = await Preferences.get({ key: 'onboardingDone' });
  if (value === 'true') {
    return router.parseUrl('/auth/login');
  }

  return true;
};
