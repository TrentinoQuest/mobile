/**
 * Test di integrazione — flusso Attività Locale (business) contro backend reale.
 *
 * Copre la registrazione business (AuthService.registerBusiness) e la facade
 * BusinessService: caricamento profilo, aggiornamento profilo, lista offerte.
 *
 * Nota sul ciclo di vita: un'attività appena registrata è in stato `pending`
 * e NON può creare offerte finché un amministratore non l'approva (regola di
 * dominio del backend). Qui verifichiamo entrambe le facce: i flussi
 * consentiti vanno a buon fine, e la regola "pending non crea offerte" è
 * applicata. La creazione di un'offerta con esito positivo richiede un account
 * già approvato (non producibile da un client player/business senza admin).
 */
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../src/app/core/services/auth/auth.service';
import { BusinessService } from '../../src/app/core/services/business/business.service';
import {
  BusinessApprovalStatus,
  BusinessType,
} from '../../src/app/core/services/business/business.types';
import { clearAuthStorage, setupTestBed, uniquePlayer, waitFor } from './helpers';

function uniqueBusiness() {
  const base = uniquePlayer('biz');
  return {
    email: base.email,
    password: base.password,
    businessName: `QA Rifugio ${base.username}`,
    businessType: BusinessType.MOUNTAIN_HUT,
    address: 'Via delle Dolomiti 1, Trento',
    position: { lat: 46.0707, lng: 11.1207 },
  };
}

describe('BusinessService [integrazione/backend reale]', () => {
  let auth: AuthService;
  let business: BusinessService;

  beforeEach(async () => {
    clearAuthStorage();
    setupTestBed();
    auth = TestBed.inject(AuthService);
    business = TestBed.inject(BusinessService);
    await firstValueFrom(auth.registerBusiness(uniqueBusiness()));
  });

  it('registerBusiness: autentica come business e imposta il ruolo', () => {
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.userRole()).toBe('business');
    expect(auth.getAccessToken()).toBeTruthy();
  });

  it('loadProfile: carica il profilo dell’attività in stato pending', async () => {
    business.loadProfile(true);
    await waitFor(() => business.profile() !== null);

    const p = business.profile()!;
    expect(p.role).toBe('business');
    expect(p.businessType).toBe(BusinessType.MOUNTAIN_HUT);
    expect(p.approvalStatus).toBe(BusinessApprovalStatus.PENDING);
    expect(business.error()).toBeNull();
  });

  it('updateProfile: modifica il nome attività e aggiorna il signal', async () => {
    const nuovoNome = `QA Rifugio aggiornato ${Date.now()}`;
    const updated = await firstValueFrom(business.updateProfile({ businessName: nuovoNome }));

    expect(updated.businessName).toBe(nuovoNome);
    expect(business.profile()?.businessName).toBe(nuovoNome);
  });

  it('loadOffers: una nuova attività non ha offerte', async () => {
    business.loadOffers(true);
    await waitFor(() => !business.loading());
    expect(business.offers()).toEqual([]);
    expect(business.error()).toBeNull();
  });

  it('createOffer: un’attività pending NON può creare offerte (regola di dominio)', async () => {
    // Il backend deve rifiutare con 403/409; la facade non deve aggiungere
    // nulla allo stato locale delle offerte.
    await expect(
      firstValueFrom(
        business.createOffer({
          title: 'Sconto QA',
          description: 'Offerta di test',
          pointsCost: 100,
        }),
      ),
    ).rejects.toMatchObject({ status: expect.any(Number) });
    expect(business.offers()).toEqual([]);
  });
});
