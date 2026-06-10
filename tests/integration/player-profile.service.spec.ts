/**
 * Test di integrazione — PlayerProfileService contro il backend reale.
 *
 * Verifica che il caricamento di collezione e progressi popoli i signal e
 * i computed (unlockedCount/totalCount) con i dati reali dell'endpoint.
 */
import { firstValueFrom } from 'rxjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../src/app/core/services/auth/auth.service';
import { PlayerProfileService } from '../../src/app/core/services/player-profile/player-profile.service';
import { clearAuthStorage, setupTestBed, uniquePlayer, waitFor } from './helpers';

describe('PlayerProfileService [integrazione/backend reale]', () => {
  let profile: PlayerProfileService;

  // UN solo player per la suite (rate limit registrazioni: vedi helpers).
  // Nessun test modifica lo stato del player, quindi condividerlo e' sicuro.
  beforeAll(async () => {
    clearAuthStorage();
    setupTestBed();
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.registerPlayer(uniquePlayer('prof')));
    profile = TestBed.inject(PlayerProfileService);
  });

  it('loadCollection: popola il signal collection (vuoto per un player nuovo)', async () => {
    profile.loadCollection(true);
    await waitFor(() => !profile.loading());

    expect(profile.error()).toBeNull();
    expect(Array.isArray(profile.collection())).toBe(true);
    expect(profile.unlockedCount()).toBe(profile.collection().length);
  });

  it('loadProgress: popola il riepilogo progressi con i totali del territorio', async () => {
    profile.loadProgress(undefined, true);
    await waitFor(() => profile.progress() !== null);

    const p = profile.progress()!;
    expect(p.totalQuests).toBeGreaterThanOrEqual(0);
    expect(p.completedQuests).toBeGreaterThanOrEqual(0);
    expect(p.completedQuests).toBeLessThanOrEqual(p.totalQuests);
    expect(profile.totalCount()).toBe(p.totalQuests);
    expect(profile.error()).toBeNull();
  });
});
