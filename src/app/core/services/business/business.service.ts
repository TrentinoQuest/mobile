import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { BusinessRepository } from './repository/business.repository';
import {
  Business,
  CreateOfferRequest,
  Offer,
  OfferStatus,
  UpdateBusinessProfileRequest,
  UpdateOfferRequest,
} from './business.types';
import { AuthService } from '../auth/auth.service';

/**
 * BusinessService — facade reattiva sopra BusinessRepository.
 *
 * Espone signal Angular per il consumo dalla UI.
 * Gestisce il profilo dell'attività corrente e le sue offerte.
 * Singleton applicazione (providedIn: 'root').
 */
@Injectable({ providedIn: 'root' })
export class BusinessService {
  private readonly repository = inject(BusinessRepository);

  constructor() {
    inject(AuthService).logout$.subscribe(() => this.reset());
  }

  // ----------------------------------------------------------------
  // Stato interno
  // ----------------------------------------------------------------

  private readonly _profile = signal<Business | null>(null);
  private readonly _offers = signal<Offer[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private _profileInitialized = false;
  private _offersInitialized = false;

  // ----------------------------------------------------------------
  // API pubblica (signal readonly)
  // ----------------------------------------------------------------

  readonly profile = this._profile.asReadonly();
  readonly offers = this._offers.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // ----------------------------------------------------------------
  // Azioni
  // ----------------------------------------------------------------

  /**
   * Garantisce che il profilo sia caricato e lo restituisce come Observable.
   * Usato dal businessStatusGuard per decidere il redirect in modo asincrono.
   * Se già caricato, ritorna il valore in memoria senza chiamate HTTP.
   */
  ensureProfile(): Observable<Business> {
    const current = this._profile();
    if (current) {
      return new Observable((sub) => {
        sub.next(current);
        sub.complete();
      });
    }
    // Carica dal repository e aggiorna i signal interni
    return this.repository.getProfile().pipe(
      tap((profile) => {
        this._profile.set(profile);
        this._profileInitialized = true;
      }),
    );
  }

  /**
   * Carica il profilo dell'attività autenticata.
   * Skip se già inizializzato; force=true forza il reload.
   */
  loadProfile(force = false): void {
    if (this._profileInitialized && !force) return;

    this._loading.set(true);
    this._error.set(null);

    this.repository
      .getProfile()
      .pipe(
        tap((profile) => {
          this._profile.set(profile);
          this._profileInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento profilo'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  /**
   * Aggiorna il profilo aziendale (PATCH /business/me).
   * Restituisce Observable per gestire toast di conferma nel componente.
   */
  updateProfile(body: UpdateBusinessProfileRequest): Observable<Business> {
    return this.repository.updateProfile(body).pipe(tap((updated) => this._profile.set(updated)));
  }

  /**
   * Carica le offerte dell'attività autenticata.
   * Skip se già inizializzato; force=true forza il reload.
   */
  loadOffers(force = false): void {
    if (this._offersInitialized && !force) return;

    this._loading.set(true);
    this._error.set(null);

    this.repository
      .getOffers()
      .pipe(
        tap((offers) => {
          this._offers.set(offers);
          this._offersInitialized = true;
        }),
        catchError((err) => {
          this._error.set(this.formatError(err, 'caricamento offerte'));
          return EMPTY;
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  /** Crea una nuova offerta (POST /business/offers). */
  createOffer(body: CreateOfferRequest): Observable<Offer> {
    return this.repository
      .createOffer(body)
      .pipe(tap((offer) => this._offers.update((list) => [offer, ...list])));
  }

  /** Modifica un'offerta esistente (PATCH /business/offers/{id}). */
  updateOffer(id: string, body: UpdateOfferRequest): Observable<Offer> {
    return this.repository
      .updateOffer(id, body)
      .pipe(
        tap((updated) =>
          this._offers.update((list) => list.map((o) => (o.id === id ? updated : o))),
        ),
      );
  }

  /**
   * Archivia un'offerta (DELETE /business/offers/{id}).
   * Il backend fa soft delete: aggiorniamo localmente status a 'archived'.
   */
  deleteOffer(id: string): Observable<void> {
    return this.repository
      .deleteOffer(id)
      .pipe(
        tap(() =>
          this._offers.update((list) =>
            list.map((o) => (o.id === id ? { ...o, status: OfferStatus.ARCHIVED } : o)),
          ),
        ),
      );
  }

  /** Reset completo dello stato. Chiamato su logout. */
  reset(): void {
    this._profile.set(null);
    this._offers.set([]);
    this._loading.set(false);
    this._error.set(null);
    this._profileInitialized = false;
    this._offersInitialized = false;
  }

  // ----------------------------------------------------------------
  // Error mapping
  // ----------------------------------------------------------------

  private formatError(err: unknown, context: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { code?: string; message?: string } | null;
      if (body?.code && ERROR_CODE_MESSAGES[body.code]) {
        return ERROR_CODE_MESSAGES[body.code];
      }
      if (body?.message) return body.message;
      return this.messageForHttpStatus(err.status, context);
    }
    if (err instanceof Error) return `Errore in ${context}: ${err.message}`;
    return `Errore sconosciuto in ${context}`;
  }

  private messageForHttpStatus(status: number, context: string): string {
    switch (status) {
      case 0:
        return 'Connessione assente. Verifica la tua rete.';
      case 401:
        return "Sessione scaduta. Effettua di nuovo l'accesso.";
      case 403:
        return 'Non hai i permessi per questa operazione.';
      case 404:
        return 'Risorsa non trovata.';
      case 500:
      case 502:
      case 503:
        return 'Il server non risponde. Riprova tra qualche istante.';
      default:
        return `Errore di rete (${status}) in ${context}`;
    }
  }
}

const ERROR_CODE_MESSAGES: Record<string, string> = {
  NOT_APPROVED: "L'attività non è ancora approvata. Non puoi creare offerte.",
  OFFER_NOT_FOUND: 'Offerta non trovata.',
  VALIDATION_ERROR: 'Dati non validi.',
};
