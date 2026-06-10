import { Provider } from '@angular/core';
import { Observable, of } from 'rxjs';
import { QuestRepository } from '../app/core/services/quest/repository/quest.repository';
import {
  GeolocationRepository,
  WatchCallback,
} from '../app/core/services/geolocation/repository/geolocation.repository';
import { PlayerProfileRepository } from '../app/core/services/player-profile/repository/player-profile.repository';
import { BusinessRepository } from '../app/core/services/business/repository/business.repository';
import type {
  AnyQuest,
  CheckInRequest,
  CheckInResponse,
  CompletionEntry,
  ScanQrRequest,
  ScanQrResponse,
} from '../app/core/services/quest/quest.types';
import type { PermissionState, Position } from '../app/core/services/geolocation/geolocation.types';
import type {
  CollectibleEntry,
  ProgressSummary,
} from '../app/core/services/player-profile/player-profile.types';
import type {
  Business,
  CouponRedeemInfo,
  CouponView,
  CreateOfferRequest,
  Offer,
  UpdateBusinessProfileRequest,
  UpdateOfferRequest,
} from '../app/core/services/business/business.types';

/**
 * Implementazioni mock dei repository per i test unitari: rispondono con
 * dati vuoti senza toccare rete o plugin nativi. I singoli test possono
 * estendere/spiare i metodi quando serve un comportamento specifico.
 */

export class MockQuestRepository extends QuestRepository {
  getQuests(): Observable<AnyQuest[]> {
    return of([]);
  }
  getQuestById(): Observable<AnyQuest> {
    return of(undefined as unknown as AnyQuest);
  }
  getCompletions(): Observable<CompletionEntry[]> {
    return of([]);
  }
  checkIn(_questId: string, _body: CheckInRequest): Observable<CheckInResponse> {
    return of(undefined as unknown as CheckInResponse);
  }
  scan(_questId: string, _body: ScanQrRequest): Observable<ScanQrResponse> {
    return of(undefined as unknown as ScanQrResponse);
  }
}

export class MockGeolocationRepository extends GeolocationRepository {
  checkPermissions(): Promise<PermissionState> {
    return Promise.resolve('denied');
  }
  requestPermissions(): Promise<PermissionState> {
    return Promise.resolve('denied');
  }
  getCurrentPosition(): Promise<Position> {
    return Promise.reject(new Error('not available in tests'));
  }
  watchPosition(_callback: WatchCallback): Promise<string> {
    return Promise.resolve('mock-watch');
  }
  clearWatch(): Promise<void> {
    return Promise.resolve();
  }
}

export class MockPlayerProfileRepository extends PlayerProfileRepository {
  getCollection(): Observable<CollectibleEntry[]> {
    return of([]);
  }
  getProgress(): Observable<ProgressSummary> {
    return of({ totalQuests: 0, completedQuests: 0, percentage: 0 });
  }
}

export class MockBusinessRepository extends BusinessRepository {
  getProfile(): Observable<Business> {
    return of(undefined as unknown as Business);
  }
  updateProfile(_body: UpdateBusinessProfileRequest): Observable<Business> {
    return of(undefined as unknown as Business);
  }
  getOffers(): Observable<Offer[]> {
    return of([]);
  }
  createOffer(_body: CreateOfferRequest): Observable<Offer> {
    return of(undefined as unknown as Offer);
  }
  updateOffer(_id: string, _body: UpdateOfferRequest): Observable<Offer> {
    return of(undefined as unknown as Offer);
  }
  deleteOffer(): Observable<void> {
    return of(undefined);
  }
  verifyCoupon(_token: string): Observable<CouponRedeemInfo> {
    return of(undefined as unknown as CouponRedeemInfo);
  }
  redeemCoupon(_token: string): Observable<CouponView> {
    return of(undefined as unknown as CouponView);
  }
}

/** Provider pronti all'uso per i TestBed dei componenti. */
export const MOCK_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: QuestRepository, useClass: MockQuestRepository },
  { provide: GeolocationRepository, useClass: MockGeolocationRepository },
  { provide: PlayerProfileRepository, useClass: MockPlayerProfileRepository },
  { provide: BusinessRepository, useClass: MockBusinessRepository },
];
