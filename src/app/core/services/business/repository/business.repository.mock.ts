import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { BusinessRepository } from './business.repository';
import {
  Business,
  CreateOfferRequest,
  Offer,
  UpdateBusinessProfileRequest,
  UpdateOfferRequest,
} from '../business.types';

/**
 * MockBusinessRepository — dati hardcoded per sviluppo offline.
 *
 * Simula il comportamento degli endpoint /business/me e /business/offers
 * con latenza realistica. Da rimuovere quando il backend è pronto.
 *
 * Mock: ristorante "Alla Trota" di Trento, stato approved, con 2 offerte attive.
 */
@Injectable()
export class MockBusinessRepository extends BusinessRepository {
  private readonly MOCK_LATENCY_MS = 250;

  // Profilo mutabile (aggiornato da PATCH /business/me)
  private profile: Business = {
    id: 'biz-001',
    email: 'info@allatrota.it',
    role: 'business',
    businessName: 'Alla Trota',
    businessType: 'restaurant',
    address: 'Via Santa Croce 12, Trento',
    position: { lat: 46.0678, lng: 11.1215 },
    approvalStatus: 'approved',
    createdAt: '2025-02-01T09:00:00Z',
  };

  // Offerte mutabili (create/modificate/archiviate in memoria)
  private offers: Offer[] = [
    {
      id: 'off-001',
      businessId: 'biz-001',
      title: 'Trota alla trentina',
      description: 'Secondo piatto tradizionale con trota del Sarca. Incluso un calice di Müller-Thurgau.',
      pointsCost: 80,
      status: 'active',
      createdAt: '2025-02-10T12:00:00Z',
    },
    {
      id: 'off-002',
      businessId: 'biz-001',
      title: 'Menù degustazione montagna',
      description: 'Cinque portate con prodotti locali: speck, canederli, strangolapreti, formaggio Vezzena e strudel.',
      pointsCost: 200,
      status: 'active',
      createdAt: '2025-02-15T10:30:00Z',
    },
    {
      id: 'off-003',
      businessId: 'biz-001',
      title: 'Aperitivo trentino',
      description: 'Spritz con Nosiola e tagliere di salumi locali. Offerta stagionale.',
      pointsCost: 50,
      status: 'archived',
      createdAt: '2025-01-20T18:00:00Z',
    },
  ];

  private nextOfferId = 4;

  override getProfile(): Observable<Business> {
    return of({ ...this.profile }).pipe(delay(this.MOCK_LATENCY_MS));
  }

  override updateProfile(body: UpdateBusinessProfileRequest): Observable<Business> {
    this.profile = { ...this.profile, ...body };
    return of({ ...this.profile }).pipe(delay(this.MOCK_LATENCY_MS));
  }

  override getOffers(): Observable<Offer[]> {
    return of(this.offers.map((o) => ({ ...o }))).pipe(delay(this.MOCK_LATENCY_MS));
  }

  override createOffer(body: CreateOfferRequest): Observable<Offer> {
    if (this.profile.approvalStatus !== 'approved') {
      return throwError(() => ({ status: 403, error: { code: 'NOT_APPROVED' } })).pipe(
        delay(this.MOCK_LATENCY_MS),
      );
    }
    const newOffer: Offer = {
      id: `off-00${this.nextOfferId++}`,
      businessId: this.profile.id,
      ...body,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.offers.push(newOffer);
    return of({ ...newOffer }).pipe(delay(this.MOCK_LATENCY_MS));
  }

  override updateOffer(id: string, body: UpdateOfferRequest): Observable<Offer> {
    const index = this.offers.findIndex((o) => o.id === id);
    if (index === -1) {
      return throwError(() => ({ status: 404, error: { code: 'OFFER_NOT_FOUND' } })).pipe(
        delay(this.MOCK_LATENCY_MS),
      );
    }
    this.offers[index] = { ...this.offers[index], ...body };
    return of({ ...this.offers[index] }).pipe(delay(this.MOCK_LATENCY_MS));
  }

  override deleteOffer(id: string): Observable<void> {
    const index = this.offers.findIndex((o) => o.id === id);
    if (index === -1) {
      return throwError(() => ({ status: 404, error: { code: 'OFFER_NOT_FOUND' } })).pipe(
        delay(this.MOCK_LATENCY_MS),
      );
    }
    // Soft delete: cambia status ad archived invece di rimuovere
    this.offers[index] = { ...this.offers[index], status: 'archived' };
    return of(undefined).pipe(
      delay(this.MOCK_LATENCY_MS),
      map(() => undefined),
    );
  }
}
