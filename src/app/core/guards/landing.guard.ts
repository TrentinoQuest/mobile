import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from '../services/auth/auth.service';
import { homePathForRole } from '../utils/role-routing';

// Guard per la landing /: reindirizza utenti autenticati alla propria home,
// utenti non autenticati senza onboardingDone all'onboarding
export const landingGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();
  if (currentUser) {
    return router.parseUrl(homePathForRole(currentUser.role));
  }

  const { value } = await Preferences.get({ key: 'onboardingDone' });
  if (value !== 'true') {
    return router.parseUrl('/onboarding');
  }

  return true;
};
