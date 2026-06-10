/**
 * Test di integrazione — SocialPage contro il backend reale.
 *
 * Copre la logica social incorporata nel componente:
 * - caricamento feed/amici/richieste;
 * - invio richiesta di amicizia (per username) + accettazione;
 * - invio kudos su un'attività reale (completamento di un amico).
 *
 * Usa due player reali (A e B), registrati UNA volta in beforeAll (rate
 * limit /auth/register: 20 / 15 min) e riusati nei test via login.
 * L'ordine dei test rispetta lo stato: "liste vuote" gira prima che A e B
 * diventino amici.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { firstValueFrom } from 'rxjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { SocialPage } from '../../src/app/features/giocatore/social/social.page';
import { AuthService } from '../../src/app/core/services/auth/auth.service';
import { api, clearAuthStorage, rawRegister, setupTestBed, waitFor } from './helpers';
import { uiStubProviders } from './stubs';

/** TestBed pulito + login con credenziali esistenti; ritorna la pagina. */
async function loginPage(creds: { email: string; password: string }) {
  clearAuthStorage();
  setupTestBed([SocialPage, ...uiStubProviders().providers]);
  const auth = TestBed.inject(AuthService);
  await firstValueFrom(auth.login({ email: creds.email, password: creds.password }));
  return TestBed.inject(SocialPage) as any;
}

describe('SocialPage [integrazione/backend reale]', () => {
  let A: Awaited<ReturnType<typeof rawRegister>>;
  let B: Awaited<ReturnType<typeof rawRegister>>;

  beforeAll(async () => {
    A = await rawRegister('socA');
    B = await rawRegister('socB');
  });

  it('carica feed, amici e richieste senza errori (player nuovo = liste vuote)', async () => {
    const page = await loginPage(A.creds);
    page['loadFeed']();
    page['loadFriends']();
    page['loadRequests']();
    await waitFor(() => !page.feedLoading() && !page.friendsLoading());

    expect(Array.isArray(page.feed())).toBe(true);
    expect(page.friends()).toEqual([]);
    expect(page.requests()).toEqual([]);
  });

  it('richiesta di amicizia per username + accettazione (flusso A→B)', async () => {
    // A invia la richiesta a B
    const aPage = await loginPage(A.creds);
    aPage.searchQuery.set(B.creds.username);
    aPage['sendFriendRequest']();
    await waitFor(() => aPage.requestSent() || !!aPage.requestError());
    expect(aPage.requestError()).toBe('');
    expect(aPage.requestSent()).toBe(true);

    // B accede, vede la richiesta e la accetta
    const bPage = await loginPage(B.creds);
    bPage['loadRequests']();
    await waitFor(() => bPage.requests().length > 0);

    const req = bPage.requests()[0];
    expect(req.friendshipId).toBeTruthy();
    bPage['acceptRequest'](req);
    await waitFor(() => bPage.requests().length === 0);

    // ora B ha A tra gli amici
    bPage['loadFriends']();
    await waitFor(() => bPage.friends().length > 0);
    expect(bPage.friends().some((f: any) => f.username === A.creds.username)).toBe(true);
  });

  it('invia kudos su un completamento reale di un amico', async () => {
    // B completa una quest secondaria via API raw => genera un'attività
    const quests = await api<any[]>('GET', '/quests', { token: B.token });
    const target = (quests.data as any[]).find((q) => q.type === 'secondary' && q.position);
    expect(target).toBeTruthy();
    const checkIn = await api<any>('POST', `/quests/${target.id}/check-in`, {
      token: B.token,
      body: {
        position: target.position,
        fix: { accuracy: 8, clientTimestamp: Date.now() },
      },
    });
    expect(checkIn.status).toBeLessThan(300);

    // A invia un kudos sull'attività di B (sono amici dal test precedente)
    const aPage = await loginPage(A.creds);
    const activityItem = {
      activityId: checkIn.data.completion.id,
      type: 'quest_completion',
      playerId: (B.user as any).id ?? (B.user as any)._id,
      username: B.creds.username,
    };
    aPage.sendKudos(activityItem);
    // dopo il completamento della POST, il flag "pending" viene rimosso
    await waitFor(() => !aPage['pendingKudos']().has(activityItem.activityId));
    // l'aggiornamento ottimistico segna il kudos come inviato
    expect(aPage['optimisticKudos']().get(activityItem.activityId)).toBe(true);
  });
});
