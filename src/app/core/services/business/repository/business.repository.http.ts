import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BusinessRepository } from './business.repository';
import {
  Business,
  CreateOfferRequest,
  Offer,
  UpdateBusinessProfileRequest,
  UpdateOfferRequest,
} from '../business.types';
import { environment } from '../../../../../environments/environment';

/**
 * HttpBusinessRepository — implementazione REST del contratto BusinessRepository.
 *
 * Allineata agli endpoint del tag business-self-mgt (swagger.yaml).
 * Autenticazione gestita automaticamente dall'authInterceptor in main.ts.
 * Errori HTTP propagati come HttpErrorResponse: li gestisce BusinessService.
 */
@Injectable()
export class HttpBusinessRepository extends BusinessRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  override getProfile(): Observable<Business> {
    return this.http.get<Business>(`${this.apiUrl}/business/me`);
  }

  override updateProfile(body: UpdateBusinessProfileRequest): Observable<Business> {
    return this.http.patch<Business>(`${this.apiUrl}/business/me`, body);
  }

  override getOffers(): Observable<Offer[]> {
    return this.http.get<Offer[]>(`${this.apiUrl}/business/offers`);
  }

  override createOffer(body: CreateOfferRequest): Observable<Offer> {
    return this.http.post<Offer>(`${this.apiUrl}/business/offers`, body);
  }

  override updateOffer(id: string, body: UpdateOfferRequest): Observable<Offer> {
    return this.http.patch<Offer>(`${this.apiUrl}/business/offers/${id}`, body);
  }

  override deleteOffer(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/business/offers/${id}`);
  }
}
