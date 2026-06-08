/**
 * Test di integrazione — CoopPage contro il backend reale.
 *
 * Copre la logica delle sfide cooperative incorporata nel componente:
 * - caricamento sfide + amici;
 * - creazione di una sfida con un partner amico (flusso reale).
 *
 * Precondizione (scaffolding): i due player devono essere amici, altrimenti
 * il backend rifiuta con NOT_FRIENDS. La amicizia viene predisposta via API
 * raw; il metodo SOTTO TEST è createChallenge() del componente.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { CoopPage } from '../../src/app/features/giocatore/coop/coop.page';
import { AuthService } from '../../src/app/core/services/auth/auth.service';
import {
  api,
  clearAuthStorage,
  rawBefriend,
  rawRegister,
  setupTestBed,
  uniquePlayer,
  waitFor,
} from './helpers';
import { uiStubProviders } from './stubs';

describe('CoopPage [integrazione/backend reale]', () => {
  let page: any;
  let partner: Awaited<ReturnType<typeof rawRegister>>;

  beforeEach(async () => {
    // B (partner) via API raw
    partner = await rawRegister('coopB');

    // A è il player del componente sotto test
    clearAuthStorage();
    setupTestBed([CoopPage, ...uiStubProviders().providers]);
    const auth = TestBed.inject(AuthService);
    const aCreds = uniquePlayer('coopA');
    const aRes = await firstValueFrom(auth.registerPlayer(aCreds));

    // Amicizia A↔B accettata (precondizione delle sfide co-op)
    await rawBefriend({ token: auth.getAccessToken()!, user: aRes.user }, partner);

    page = TestBed.inject(CoopPage) as any;
  });

  it('carica le sfide e gli amici (nuovo player: zero sfide, un amico)', async () => {
    page['loadAll']();
    await waitFor(() => !page.loading());
    expect(page.challenges()).toEqual([]);
    expect(page.friends().length).toBeGreaterThanOrEqual(1);
  });

  it('createChallenge: crea una sfida co-op con un amico', async () => {
    page['loadAll']();
    await waitFor(() => page.friends().length > 0);

    const friend = page.friends()[0];
    page['selectType']('walk_50km');
    page['selectPartner'](friend.playerId);
    expect(page.canCreate()).toBe(true);

    await page.createChallenge();
    await waitFor(() => page.challenges().length > 0);

    const challenge = page.challenges()[0];
    expect(challenge.type).toBe('walk_50km');
    expect(page.showCreateSheet()).toBe(false);
  });

  it('createChallenge senza amico selezionato: canCreate è false e non chiama il backend', async () => {
    page['loadAll']();
    await waitFor(() => !page.loading());
    page['selectType']('complete_10_quests');
    // nessun partner selezionato
    expect(page.canCreate()).toBe(false);
    const before = page.challenges().length;
    await page.createChallenge();
    expect(page.challenges().length).toBe(before);
  });

  it('la sfida creata è visibile anche al partner via API', async () => {
    page['loadAll']();
    await waitFor(() => page.friends().length > 0);
    page['selectType']('unlock_5_rare');
    page['selectPartner'](page.friends()[0].playerId);
    await page.createChallenge();
    await waitFor(() => page.challenges().length > 0);

    const partnerChallenges = await api<any[]>('GET', '/coop/challenges', { token: partner.token });
    expect(partnerChallenges.status).toBe(200);
    expect(Array.isArray(partnerChallenges.data)).toBe(true);
    expect(partnerChallenges.data.length).toBeGreaterThanOrEqual(1);
  });
});
