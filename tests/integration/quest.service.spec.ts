/**
 * Test di integrazione — QuestService contro il backend reale.
 *
 * Verifica l'implementazione della facade reattiva sulle quest:
 * - loadQuests/loadCompletions popolano i signal;
 * - i computed (primary/secondary/discoveredCount) derivano correttamente;
 * - checkIn() su una quest secondaria, alla sua posizione, completa davvero
 *   e aggiorna lo stato (anti-cheat fix incluso via GeolocationService);
 * - scan() con token non valido propaga l'errore applicativo del backend.
 */
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../src/app/core/services/auth/auth.service';
import { QuestService } from '../../src/app/core/services/quest/quest.service';
import { GeolocationService } from '../../src/app/core/services/geolocation/geolocation.service';
import { QuestType, SecondaryQuest } from '../../src/app/core/services/quest/quest.types';
import {
  clearAuthStorage,
  FakeGeolocationService,
  setupTestBed,
  uniquePlayer,
  waitFor,
} from './helpers';

describe('QuestService [integrazione/backend reale]', () => {
  let quest: QuestService;
  let geo: FakeGeolocationService;

  beforeEach(async () => {
    clearAuthStorage();
    setupTestBed();
    // Serve un player autenticato perché /quests richiede il Bearer token.
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.registerPlayer(uniquePlayer('quest')));
    quest = TestBed.inject(QuestService);
    geo = TestBed.inject(GeolocationService) as unknown as FakeGeolocationService;
  });

  it('loadQuests: popola i signal quests/primary/secondary', async () => {
    quest.loadQuests();
    await waitFor(() => quest.quests().length > 0);

    expect(quest.totalCount()).toBeGreaterThan(0);
    expect(quest.primaryQuests().every((q) => q.type === QuestType.PRIMARY)).toBe(true);
    expect(quest.secondaryQuests().every((q) => q.type === QuestType.SECONDARY)).toBe(true);
    expect(quest.error()).toBeNull();
    // somma delle due tipologie = totale
    expect(quest.primaryQuests().length + quest.secondaryQuests().length).toBe(
      quest.totalCount(),
    );
  });

  it('loadCompletions: un player appena registrato ha zero completamenti', async () => {
    quest.loadCompletions(100, 0, true);
    await waitFor(() => !quest.loading());
    expect(quest.completions()).toEqual([]);
    expect(quest.error()).toBeNull();
  });

  it('checkIn: completa una quest secondaria alla sua posizione e aggiorna lo stato', async () => {
    quest.loadQuests();
    await waitFor(() => quest.secondaryQuests().length > 0);

    const target = quest.secondaryQuests()[0] as SecondaryQuest;
    // Posiziona il GeolocationService fake esattamente sul target: l'app
    // allega il `fix` anti-cheat e il backend deve accettare il check-in.
    geo.setFix(8);

    const before = quest.completions().length;
    const res = await firstValueFrom(
      quest.checkIn(target.id, { position: { lat: target.position.lat, lng: target.position.lng } }),
    );

    // La response rispetta il contratto CheckInResponse
    expect(res.completion).toBeTruthy();
    expect(res.completion.questId).toBe(target.id);
    expect(res.pointsAwarded).toBeGreaterThanOrEqual(0);
    expect(res.distanceFromTargetMeters).toBeGreaterThanOrEqual(0);
    expect(res.gamification).toBeTruthy();
    expect(typeof res.gamification.coinsAwarded).toBe('number');

    // L'implementazione del service ha aggiunto il completamento al signal
    expect(quest.completions().length).toBe(before + 1);
    expect(quest.playerStatusOf(target.id)).toBe('discovered');
  });

  it('checkIn ripetuto sulla stessa quest: il backend rifiuta il duplicato', async () => {
    quest.loadQuests();
    await waitFor(() => quest.secondaryQuests().length > 1);

    const target = quest.secondaryQuests()[1] as SecondaryQuest;
    geo.setFix(8);
    await firstValueFrom(
      quest.checkIn(target.id, { position: { lat: target.position.lat, lng: target.position.lng } }),
    );

    // secondo check-in => 409 QUEST_ALREADY_COMPLETED
    await expect(
      firstValueFrom(
        quest.checkIn(target.id, {
          position: { lat: target.position.lat, lng: target.position.lng },
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('scan: un token QR non valido viene rifiutato dal backend (409)', async () => {
    quest.loadQuests();
    await waitFor(() => quest.primaryQuests().length > 0);

    const target = quest.primaryQuests()[0];
    geo.setFix(8);

    // Lo scan reale richiede il token segreto stampato sul QR in loco, non
    // disponibile lato client: verifichiamo che l'anti-cheat lo rifiuti.
    await expect(
      firstValueFrom(
        quest.scan(target.id, {
          qrToken: 'token-non-valido',
          position: { lat: target.searchArea.lat, lng: target.searchArea.lng },
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
