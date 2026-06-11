/**
 * Test di integrazione — ShopPage (Mercato Coupon) contro il backend reale.
 *
 * Copre la logica del mercato incorporata nel componente:
 * - caricamento offerte e coupon;
 * - acquisto reale di un'offerta (con conferma utente simulata), dopo aver
 *   accumulato punti sufficienti con check-in reali.
 *
 * Nota economia: il saldo spendibile sul mercato è `totalPoints` (un check-in
 * vale ~45 punti); l'offerta più economica costa 100. Accumuliamo punti con
 * alcuni check-in reali prima di acquistare.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { firstValueFrom } from 'rxjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { ShopPage } from '../../src/app/features/giocatore/shop/shop.page';
import { AuthService } from '../../src/app/core/services/auth/auth.service';
import {
  clearAuthStorage,
  rawEarnAtLeast,
  setupTestBed,
  uniquePlayer,
  waitFor,
} from './helpers';
import { uiStubProviders } from './stubs';

describe('ShopPage [integrazione/backend reale]', () => {
  let page: any;
  let token: string;

  // UN solo player per la suite (rate limit registrazioni: vedi helpers).
  // Ordine dei test rilevante: i casi "player nuovo / senza punti" girano
  // PRIMA del test che accumula punti e acquista.
  beforeAll(async () => {
    clearAuthStorage();
    setupTestBed([ShopPage, ...uiStubProviders().providers]);
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.registerPlayer(uniquePlayer('shop')));
    token = auth.getAccessToken()!;
    page = TestBed.inject(ShopPage) as any;
  });

  it('loadOffers: popola il signal offers con le offerte del mercato', async () => {
    page['loadOffers']();
    await waitFor(() => !page.offersLoading());
    expect(page.offersError()).toBe('');
    expect(Array.isArray(page.offers())).toBe(true);
    expect(page.offers().length).toBeGreaterThan(0);
    expect(page.offers()[0]).toHaveProperty('pointsCost');
  });

  it('loadCoupons: un player nuovo non ha coupon', async () => {
    page['loadCoupons']();
    await waitFor(() => !page.couponsLoading());
    expect(page.coupons()).toEqual([]);
  });

  it('purchaseOffer senza punti: il backend rifiuta e non crea coupon', async () => {
    page['loadOffers']();
    await waitFor(() => page.offers().length > 0);
    const offer = page.offers()[0];

    await page.purchaseOffer(offer);
    // un attimo per far completare la POST fallita
    await new Promise((r) => setTimeout(r, 1500));

    expect(page.activeCoupon()).toBeNull();
    expect(page.purchasing()).toBeNull();
  });

  it('purchaseOffer: acquista l’offerta più economica dopo aver accumulato punti', async () => {
    page['loadOffers']();
    await waitFor(() => page.offers().length > 0);
    const cheapest = [...page.offers()].sort((a: any, b: any) => a.pointsCost - b.pointsCost)[0];

    // Accumula coins sufficienti con check-in reali: l'economia per
    // check-in la decide il backend, quindi leggiamo il saldo reale.
    const balance = await rawEarnAtLeast(token, cheapest.pointsCost);
    expect(balance).toBeGreaterThanOrEqual(cheapest.pointsCost);

    // L'AlertController stub conferma automaticamente l'acquisto.
    await page.purchaseOffer(cheapest);
    await waitFor(() => page.activeCoupon() !== null, { timeout: 20_000 });

    const coupon = page.activeCoupon();
    expect(coupon.offerId).toBe(cheapest.id);
    expect(coupon.token).toBeTruthy();
    expect(coupon.status).toBe('active');
    expect(page.purchasing()).toBeNull();

    // il coupon appena acquistato compare tra i miei coupon
    page['loadCoupons']();
    await waitFor(() => page.coupons().some((c: any) => c.token === coupon.token));

    page['closeCoupon'](); // ferma il countdown interval
  });
});
