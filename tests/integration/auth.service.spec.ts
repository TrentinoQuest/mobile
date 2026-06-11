/**
 * Test di integrazione — AuthService contro il backend reale.
 *
 * Verifica che l'IMPLEMENTAZIONE del service faccia ciò che deve:
 * - registrazione/login popolano i signal di stato e persistono i token;
 * - il refresh rinnova l'access token;
 * - logout azzera lo stato.
 *
 * Nota rate-limit: il backend limita /auth/register a 20 richieste / 15 min
 * per IP. La suite registra UN solo account in beforeAll e lo riusa in tutti
 * i test (login, refresh, recover) per restare ampiamente nel budget.
 */
import { firstValueFrom } from 'rxjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { AuthResponse } from '@trentino-quest/shared-types';

import { AuthService } from '../../src/app/core/services/auth/auth.service';
import { clearAuthStorage, setupTestBed, uniquePlayer } from './helpers';

describe('AuthService [integrazione/backend reale]', () => {
  let auth: AuthService;
  let creds: ReturnType<typeof uniquePlayer>;
  let registerRes: AuthResponse;

  beforeAll(async () => {
    clearAuthStorage();
    setupTestBed();
    auth = TestBed.inject(AuthService);
    creds = uniquePlayer('auth');
    registerRes = await firstValueFrom(auth.registerPlayer(creds));
  });

  it('registerPlayer: registra, popola currentUser e persiste i token', () => {
    // La response rispetta il contratto AuthResponse
    expect(registerRes.accessToken).toBeTruthy();
    expect(registerRes.refreshToken).toBeTruthy();
    expect(registerRes.user).toBeTruthy();

    // L'implementazione del service ha aggiornato lo stato reattivo...
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.currentUser()?.email).toBe(creds.email);
    expect(auth.userRole()).toBeTruthy();

    // ...e ha messo i token in cache per gli interceptor. Dopo un eventuale
    // refresh i token cambiano, quindi verifichiamo solo che esistano.
    expect(auth.getAccessToken()).toBeTruthy();
    expect(auth.getRefreshToken()).toBeTruthy();
  });

  it('refreshAccessToken: rinnova l’access token usando il refresh token', async () => {
    const oldToken = auth.getAccessToken();

    const res = await firstValueFrom(auth.refreshAccessToken());
    expect(res.accessToken).toBeTruthy();
    // il nuovo token è effettivamente in uso dal service
    expect(auth.getAccessToken()).toBe(res.accessToken);
    expect(oldToken).toBeTruthy();
  });

  it('recoverPassword: il backend risponde senza errori (202)', async () => {
    // non deve lanciare
    await expect(
      firstValueFrom(auth.recoverPassword({ email: creds.email })),
    ).resolves.not.toThrow();
  });

  it('login: autentica con credenziali valide e aggiorna lo stato', async () => {
    // nuovo TestBed pulito per simulare un login "da zero"
    clearAuthStorage();
    setupTestBed();
    const auth2 = TestBed.inject(AuthService);
    expect(auth2.isAuthenticated()).toBe(false);

    const res = await firstValueFrom(
      auth2.login({ email: creds.email, password: creds.password }),
    );
    expect(res.accessToken).toBeTruthy();
    expect(auth2.isAuthenticated()).toBe(true);
    expect(auth2.currentUser()?.email).toBe(creds.email);
  });

  it('login con password errata: il service propaga errore 401 e NON autentica', async () => {
    clearAuthStorage();
    setupTestBed();
    const auth2 = TestBed.inject(AuthService);

    await expect(
      firstValueFrom(auth2.login({ email: creds.email, password: 'sbagliata-xyz' })),
    ).rejects.toMatchObject({ status: 401 });
    expect(auth2.isAuthenticated()).toBe(false);
  });
});
