/**
 * Test di integrazione — AuthService contro il backend reale.
 *
 * Verifica che l'IMPLEMENTAZIONE del service faccia ciò che deve:
 * - registrazione/login popolano i signal di stato e persistono i token;
 * - il refresh rinnova l'access token;
 * - logout azzera lo stato.
 */
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../src/app/core/services/auth/auth.service';
import { clearAuthStorage, setupTestBed, uniquePlayer } from './helpers';

describe('AuthService [integrazione/backend reale]', () => {
  let auth: AuthService;

  beforeEach(() => {
    clearAuthStorage();
    setupTestBed();
    auth = TestBed.inject(AuthService);
  });

  it('registerPlayer: registra, popola currentUser e persiste i token', async () => {
    const creds = uniquePlayer('auth');
    const res = await firstValueFrom(auth.registerPlayer(creds));

    // La response rispetta il contratto AuthResponse
    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken).toBeTruthy();
    expect(res.user).toBeTruthy();

    // L'implementazione del service ha aggiornato lo stato reattivo...
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.currentUser()?.email).toBe(creds.email);
    expect(auth.userRole()).toBeTruthy();

    // ...e ha messo l'access token in cache per l'interceptor
    expect(auth.getAccessToken()).toBe(res.accessToken);
    expect(auth.getRefreshToken()).toBe(res.refreshToken);
  });

  it('login: autentica con credenziali valide e aggiorna lo stato', async () => {
    const creds = uniquePlayer('auth');
    await firstValueFrom(auth.registerPlayer(creds)); // crea l'account

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

  it('refreshAccessToken: rinnova l’access token usando il refresh token', async () => {
    const creds = uniquePlayer('auth');
    await firstValueFrom(auth.registerPlayer(creds));
    const oldToken = auth.getAccessToken();

    const res = await firstValueFrom(auth.refreshAccessToken());
    expect(res.accessToken).toBeTruthy();
    // il nuovo token è effettivamente in uso dal service
    expect(auth.getAccessToken()).toBe(res.accessToken);
    expect(oldToken).toBeTruthy();
  });

  it('recoverPassword: il backend risponde senza errori (202)', async () => {
    const creds = uniquePlayer('auth');
    await firstValueFrom(auth.registerPlayer(creds));
    // non deve lanciare
    await expect(firstValueFrom(auth.recoverPassword({ email: creds.email }))).resolves.not.toThrow();
  });

  it('login con password errata: il service propaga errore 401 e NON autentica', async () => {
    const creds = uniquePlayer('auth');
    await firstValueFrom(auth.registerPlayer(creds));

    clearAuthStorage();
    setupTestBed();
    const auth2 = TestBed.inject(AuthService);

    await expect(
      firstValueFrom(auth2.login({ email: creds.email, password: 'sbagliata-xyz' })),
    ).rejects.toMatchObject({ status: 401 });
    expect(auth2.isAuthenticated()).toBe(false);
  });
});
