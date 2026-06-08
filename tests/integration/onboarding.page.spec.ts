/**
 * Test di integrazione — OnboardingPage contro il backend reale.
 *
 * Verifica che il completamento dell'onboarding dal componente:
 * - persista il flag locale `onboardingDone`;
 * - invochi davvero POST /onboarding/complete sul backend, il cui effetto è
 *   osservabile su GET /player/me (`onboardingCompleted` passa a true).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { firstValueFrom } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { OnboardingPage } from '../../src/app/features/common/onboarding/onboarding.page';
import { AuthService } from '../../src/app/core/services/auth/auth.service';
import { api, clearAuthStorage, setupTestBed, uniquePlayer, waitFor } from './helpers';
import { uiStubProviders } from './stubs';

describe('OnboardingPage [integrazione/backend reale]', () => {
  let page: any;
  let token: string;

  beforeEach(async () => {
    clearAuthStorage();
    setupTestBed([OnboardingPage, ...uiStubProviders().providers]);
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.registerPlayer(uniquePlayer('onb')));
    token = auth.getAccessToken()!;
    page = TestBed.inject(OnboardingPage) as any;
  });

  it('onRegistrationComplete: completa l’onboarding lato backend e salva il flag locale', async () => {
    // stato iniziale: onboarding non completato
    const before = await api<any>('GET', '/player/me', { token });
    expect(before.data.onboardingCompleted).toBe(false);

    await page['onRegistrationComplete']();

    // flag locale persistito
    const flag = await Preferences.get({ key: 'onboardingDone' });
    expect(flag.value).toBe('true');

    // effetto reale sul backend osservabile su /player/me
    await waitFor(async () => {
      const me = await api<any>('GET', '/player/me', { token });
      return me.data.onboardingCompleted === true;
    });
  });
});
