import { Observable } from 'rxjs';
import {
  Business,
  CreateOfferRequest,
  Offer,
  UpdateBusinessProfileRequest,
  UpdateOfferRequest,
} from '../business.types';

/**
 * BusinessRepository — contratto astratto per l'accesso ai dati dell'attività locale.
 *
 * Allineato agli endpoint REST del tag business-self-mgt (swagger.yaml).
 * Implementazioni: MockBusinessRepository (sviluppo offline), HttpBusinessRepository (produzione).
 * Binding tramite DI in main.ts via environment.businessRepository.
 */
export abstract class BusinessRepository {
  /** GET /business/me — profilo dell'attività autenticata. */
  abstract getProfile(): Observable<Business>;

  /** PATCH /business/me — aggiorna il profilo aziendale. */
  abstract updateProfile(body: UpdateBusinessProfileRequest): Observable<Business>;

  /** GET /business/offers — lista le offerte dell'attività autenticata. */
  abstract getOffers(): Observable<Offer[]>;

  /** POST /business/offers — crea una nuova offerta (solo se approved). */
  abstract createOffer(body: CreateOfferRequest): Observable<Offer>;

  /** PATCH /business/offers/{id} — modifica una propria offerta. */
  abstract updateOffer(id: string, body: UpdateOfferRequest): Observable<Offer>;

  /** DELETE /business/offers/{id} — archivia una propria offerta (soft delete, 204). */
  abstract deleteOffer(id: string): Observable<void>;
}
