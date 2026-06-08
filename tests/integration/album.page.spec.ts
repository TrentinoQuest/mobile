/**
 * Test di integrazione — TaccuinoPage (album) contro il backend reale.
 *
 * Copre la logica backend incorporata nel componente:
 * - Quiz della Lore: caricamento domanda del giorno + invio risposta;
 * - Missioni giornaliere: caricamento + riscossione (claim).
 *
 * Si istanzia la classe del componente via DI (senza renderizzare il template
 * Ionic) e si invocano i metodi reali, esattamente come farebbe la UI.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { AlbumPage } from '../../src/app/features/giocatore/album/album.page';
import { AuthService } from '../../src/app/core/services/auth/auth.service';
import { clearAuthStorage, setupTestBed, uniquePlayer, waitFor } from './helpers';
import { uiStubProviders } from './stubs';

describe('TaccuinoPage / album [integrazione/backend reale]', () => {
  let page: any;

  beforeEach(async () => {
    clearAuthStorage();
    setupTestBed([AlbumPage, ...uiStubProviders().providers]);
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.registerPlayer(uniquePlayer('album')));
    page = TestBed.inject(AlbumPage);
  });

  it('Quiz Lore: carica la domanda del giorno con 4 opzioni', async () => {
    page['loadQuiz']();
    await waitFor(() => page.quizQuestion() !== null);

    const q = page.quizQuestion();
    expect(typeof q.text).toBe('string');
    expect(Array.isArray(q.options)).toBe(true);
    expect(q.options.length).toBe(4);
  });

  it('Quiz Lore: invia la risposta e riceve esito + spiegazione', async () => {
    page['loadQuiz']();
    await waitFor(() => page.quizQuestion() !== null);

    await page.answerQuiz(0);
    await waitFor(() => page.quizResult() !== null);

    const res = page.quizResult();
    expect(typeof res.correct).toBe('boolean');
    expect(typeof res.explanation).toBe('string');
    // dopo la risposta il form si blocca
    expect(page.quizSelectedIndex()).toBe(0);
  });

  it('Missioni giornaliere: carica le 3 missioni del giorno', async () => {
    page['loadMissions']();
    await waitFor(() => page.missions().length > 0);

    const missions = page.missions();
    expect(missions.length).toBeGreaterThanOrEqual(1);
    expect(missions[0]).toHaveProperty('type');
    expect(missions[0]).toHaveProperty('xpReward');
    expect(missions[0]).toHaveProperty('coinsReward');
  });

  it('Missioni giornaliere: claim segna la missione come riscossa', async () => {
    page['loadMissions']();
    await waitFor(() => page.missions().length > 0);

    const type = page.missions()[0].type;
    await page.claimMission(type);
    await waitFor(() => page.claimedMissions().has(type));

    expect(page.claimedMissions().has(type)).toBe(true);
    expect(page.missionsCompleting().has(type)).toBe(false);
  });
});
