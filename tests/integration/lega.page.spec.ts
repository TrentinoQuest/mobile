/**
 * Test — LegaPage: la classifica del girone viene popolata da /leagues/current.
 *
 * Usiamo un HttpClient stub (non serve il backend) perché un account "in lega"
 * non è producibile da un client di test: la membership al girone è creata da
 * un processo schedulato lato backend. Verifichiamo che, data la response del
 * contratto OpenAPI (oggetto nudo), il componente esponga `current()` con la
 * `leaderboard` dei 30 giocatori che il template itera.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { LegaPage } from '../../src/app/features/giocatore/lega/lega.page';
import { uiStubProviders } from './stubs';

const leaguePayload = {
  season: { weekStart: '2026-06-08T00:00:00.000Z', weekEnd: '2026-06-14T23:59:59.000Z' },
  tier: 'porfido',
  groupId: 'group-1',
  rank: 3,
  weeklyXp: 240,
  leaderboard: [
    { rank: 1, playerId: 'p1', username: 'Alice', weeklyXp: 500, isCurrentPlayer: false, isFriend: true },
    { rank: 2, playerId: 'p2', username: 'Bob', weeklyXp: 300, isCurrentPlayer: false, isFriend: false },
    { rank: 3, playerId: 'me', username: 'Io', weeklyXp: 240, isCurrentPlayer: true, isFriend: false },
  ],
};

/** HttpClient stub: /leagues/current risponde con la forma data, gli altri vuoti. */
function stubHttp(leaguesResponse: unknown) {
  return {
    get: (url: string) => {
      if (url.includes('/leagues/current')) return of(leaguesResponse);
      return of([]); // /social/friends, /social/friends/requests
    },
    post: () => of({}),
    delete: () => of({}),
  } as unknown as HttpClient;
}

function makePage(leaguesResponse: unknown): any {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      LegaPage,
      { provide: HttpClient, useValue: stubHttp(leaguesResponse) },
      ...uiStubProviders().providers,
    ],
  });
  return TestBed.inject(LegaPage) as any;
}

describe('LegaPage — classifica girone', () => {
  beforeEach(() => {
    /* nessun backend reale: solo stub */
  });

  it('popola current() con info card e classifica del girone (response nuda del contratto)', () => {
    const page = makePage(leaguePayload);
    page.ngOnInit();

    const league = page.current();
    expect(league).not.toBeNull();
    expect(league.tier).toBe('porfido');
    expect(league.rank).toBe(3);
    // la classifica che il template itera è popolata
    expect(league.leaderboard.length).toBe(3);
    expect(league.leaderboard[0].username).toBe('Alice');
    expect(league.leaderboard.some((m: any) => m.isCurrentPlayer)).toBe(true);
  });
});
