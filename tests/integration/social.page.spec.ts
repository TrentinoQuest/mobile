/**
 * Test di integrazione — SocialPage contro il backend reale.
 *
 * Copre la logica social incorporata nel componente:
 * - caricamento feed/amici/richieste;
 * - invio richiesta di amicizia (per username) + accettazione;
 * - invio kudos su un'attività reale (completamento di un amico).
 *
 * Usa due player reali (A e B) per esercitare i flussi relazionali.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { SocialPage } from '../../src/app/features/giocatore/social/social.page';
import { AuthService } from '../../src/app/core/services/auth/auth.service';
import { QuestService } from '../../src/app/core/services/quest/quest.service';
import { GeolocationService } from '../../src/app/core/services/geolocation/geolocation.service';
import { SecondaryQuest } from '../../src/app/core/services/quest/quest.types';
import {
  clearAuthStorage,
  FakeGeolocationService,
  setupTestBed,
  uniquePlayer,
  waitFor,
} from './helpers';
import { uiStubProviders } from './stubs';

/** Registra un player isolato (TestBed pulito) e ritorna l'AuthService. */
async function freshPlayer(tag: string) {
  clearAuthStorage();
  setupTestBed([SocialPage, ...uiStubProviders().providers]);
  const auth = TestBed.inject(AuthService);
  const creds = uniquePlayer(tag);
  const res = await firstValueFrom(auth.registerPlayer(creds));
  return { auth, creds, user: res.user, page: TestBed.inject(SocialPage) as any };
}

describe('SocialPage [integrazione/backend reale]', () => {
  let A: Awaited<ReturnType<typeof freshPlayer>>;

  beforeEach(async () => {
    A = await freshPlayer('socA');
  });

  it('carica feed, amici e richieste senza errori (player nuovo = liste vuote)', async () => {
    A.page['loadFeed']();
    A.page['loadFriends']();
    A.page['loadRequests']();
    await waitFor(() => !A.page.feedLoading() && !A.page.friendsLoading());

    expect(Array.isArray(A.page.feed())).toBe(true);
    expect(A.page.friends()).toEqual([]);
    expect(A.page.requests()).toEqual([]);
  });

  it('richiesta di amicizia per username + accettazione (flusso A→B)', async () => {
    // B esiste già; ne creo uno e ne ricavo username
    const bCreds = uniquePlayer('socB');
    {
      clearAuthStorage();
      setupTestBed([SocialPage, ...uiStubProviders().providers]);
      await firstValueFrom(TestBed.inject(AuthService).registerPlayer(bCreds));
    }

    // A invia la richiesta a B
    A = await freshPlayer('socA');
    A.page.searchQuery.set(bCreds.username);
    A.page['sendFriendRequest']();
    await waitFor(() => A.page.requestSent() || !!A.page.requestError());
    expect(A.page.requestError()).toBe('');
    expect(A.page.requestSent()).toBe(true);

    // B accede, vede la richiesta e la accetta
    clearAuthStorage();
    setupTestBed([SocialPage, ...uiStubProviders().providers]);
    await firstValueFrom(
      TestBed.inject(AuthService).login({ email: bCreds.email, password: bCreds.password }),
    );
    const bPage = TestBed.inject(SocialPage) as any;
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
    // B si registra e completa una quest secondaria => genera un'attività
    const bCreds = uniquePlayer('socKB');
    clearAuthStorage();
    setupTestBed([
      SocialPage,
      { provide: GeolocationService, useClass: FakeGeolocationService },
      ...uiStubProviders().providers,
    ]);
    const bAuth = TestBed.inject(AuthService);
    const bUser = (await firstValueFrom(bAuth.registerPlayer(bCreds))).user;
    const bQuest = TestBed.inject(QuestService);
    const bGeo = TestBed.inject(GeolocationService) as unknown as FakeGeolocationService;
    bQuest.loadQuests();
    await waitFor(() => bQuest.secondaryQuests().length > 0);
    const target = bQuest.secondaryQuests()[0] as SecondaryQuest;
    bGeo.setFix(8);
    const completion = await firstValueFrom(
      bQuest.checkIn(target.id, { position: { lat: target.position.lat, lng: target.position.lng } }),
    );

    // A invia un kudos sull'attività di B
    A = await freshPlayer('socKA');
    const activityItem = {
      activityId: completion.completion.id,
      type: 'quest_completion',
      playerId: (bUser as any).id ?? (bUser as any)._id,
      username: bCreds.username,
    };
    A.page.sendKudos(activityItem);
    // dopo il completamento della POST, il flag "pending" viene rimosso
    await waitFor(() => !A.page['pendingKudos']().has(activityItem.activityId));
    // l'aggiornamento ottimistico segna il kudos come inviato
    expect(A.page['optimisticKudos']().get(activityItem.activityId)).toBe(true);
  });
});
