import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import {
  AuthenticatedUser,
  AuthResponse,
  LoginRequest,
  LogoutRequest,
  PasswordRecoveryRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RegisterPlayerRequest,
  UserRole,
} from '@trentino-quest/shared-types';
import { environment } from '../../../../environments/environment';

/**
 * AuthService — Gestione autenticazione e sessione utente.
 *
 * Responsabilita:
 * - Esporre lo stato dell'utente corrente come Signal reattivi
 * - Effettuare le chiamate HTTP agli endpoint /auth/*
 * - Persistere i token (access + refresh) e l'utente in Capacitor Preferences
 * - Caricare lo stato di sessione all'avvio dell'app (via provideAppInitializer)
 * - Verificare la raggiungibilita del backend tramite /health
 *
 * Strategia di sicurezza: pattern access token + refresh token.
 * - accessToken: JWT breve (15 min) allegato a tutte le chiamate API
 * - refreshToken: stringa opaque lunga (30 giorni) usata solo per /auth/refresh
 *
 * NOTA: il servizio non gestisce navigazione (no Router) ne errori HTTP
 * semantici. Lascia entrambe le responsabilita ai consumatori (componenti,
 * guard, interceptor).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  // ===========================================================================
  // 1. COSTANTI
  // ===========================================================================

  /** Chiave Preferences per l'access token JWT. */
  private static readonly KEY_ACCESS_TOKEN = 'tq_access_token';

  /** Chiave Preferences per il refresh token. */
  private static readonly KEY_REFRESH_TOKEN = 'tq_refresh_token';

  /** Chiave Preferences per l'utente autenticato (JSON serializzato). */
  private static readonly KEY_USER = 'tq_user';

  // ===========================================================================
  // 2. DEPENDENCY INJECTION
  // ===========================================================================

  private readonly http = inject(HttpClient);

  // ===========================================================================
  // 3. STATO INTERNO
  // ===========================================================================

  /**
   * Signal modificabile interno con l'utente autenticato.
   * Esposto pubblicamente in versione readonly come `currentUser`.
   */
  private readonly _currentUser = signal<AuthenticatedUser | null>(null);

  /**
   * Cache in-memory del access token, sincronizzata con Preferences.
   * Permette agli interceptor di leggerlo sincronicamente senza Promise.
   */
  private accessTokenCache: string | null = null;

  /**
   * Cache in-memory del refresh token, sincronizzata con Preferences.
   */
  private refreshTokenCache: string | null = null;

  // ===========================================================================
  // 4. API PUBBLICA REATTIVA (Signal)
  // ===========================================================================

  /** Utente correntemente autenticato, oppure null se non autenticato. */
  readonly currentUser = this._currentUser.asReadonly();

  /** True se c'e un utente autenticato, false altrimenti. */
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /** Ruolo dell'utente corrente, o null se non autenticato. */
  readonly userRole = computed<UserRole | null>(() => this._currentUser()?.role ?? null);

  // ===========================================================================
  // 5. API PUBBLICA HTTP
  // ===========================================================================

  /**
   * Registra un nuovo Giocatore.
   * Salva automaticamente i token e l'utente in Preferences in caso di successo.
   */
  registerPlayer(req: RegisterPlayerRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, req)
      .pipe(tap((response) => this.handleAuthSuccess(response)));
  }

  /**
   * Autentica un utente esistente.
   * Salva automaticamente i token e l'utente in Preferences in caso di successo.
   */
  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, req)
      .pipe(tap((response) => this.handleAuthSuccess(response)));
  }

  /**
   * Termina la sessione corrente.
   *
   * Strategia "fire and forget": cancelliamo immediatamente lo stato locale
   * e mandiamo la chiamata di logout al backend in background. Se il backend
   * non riceve la chiamata, il refresh token resta nel DB ma l'access token
   * scade comunque entro 15 minuti.
   */
  logout(): void {
    const refreshToken = this.refreshTokenCache;

    // 1. Cancella stato locale immediatamente
    this.handleLogoutSuccess();

    // 2. Notifica il backend in background, senza aspettare ne gestire errori
    if (refreshToken) {
      const body: LogoutRequest = { refreshToken };
      this.http.post<void>(`${environment.apiUrl}/auth/logout`, body).subscribe({
        error: () => {
          // Logout backend fallito: ignoriamo, il refresh token scadra
          // naturalmente lato server.
        },
      });
    }
  }

  /**
   * Avvia il flusso di recupero password.
   * Il backend risponde sempre con 202 per non rivelare quali email sono
   * registrate.
   */
  recoverPassword(req: PasswordRecoveryRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/password-recovery`, req);
  }

  /**
   * Rinnova l'access token usando il refresh token corrente.
   * Chiamato dall'interceptor di refresh quando una richiesta riceve 401.
   *
   * Salva automaticamente i nuovi token in Preferences (rotation: anche il
   * refresh token cambia a ogni rinnovo).
   *
   * Se non c'e un refresh token disponibile, ritorna un errore senza chiamare
   * il backend.
   */
  refreshAccessToken(): Observable<RefreshTokenResponse> {
    const refreshToken = this.refreshTokenCache;

    if (!refreshToken) {
      // Nessun refresh token disponibile: ritorna un Observable di errore
      // sintetico. L'interceptor lo trattera come fallimento e fara logout.
      return new Observable((subscriber) => {
        subscriber.error(new Error('No refresh token available'));
      });
    }

    const body: RefreshTokenRequest = { refreshToken };

    return this.http
      .post<RefreshTokenResponse>(`${environment.apiUrl}/auth/refresh`, body)
      .pipe(tap((response) => this.handleRefreshSuccess(response)));
  }

  // ===========================================================================
  // 6. API PUBBLICA BOOTSTRAP
  // ===========================================================================

  /**
   * Carica i token e l'utente da Preferences all'avvio dell'app.
   * Chiamato da provideAppInitializer.
   *
   * Strategia "tollerante": se il access token e' scaduto, lo cancelliamo
   * insieme al refresh token e all'utente, riportando lo stato a non
   * autenticato. L'utente vedra la landing pubblica.
   *
   * NOTA: non chiamiamo il backend per validare il token. Ci fidiamo della
   * decodifica locale del campo `exp`. Eventuali edge case (token revocato
   * lato server) saranno gestiti dal refreshInterceptor al primo 401.
   */
  async loadFromStorage(): Promise<void> {
    const [accessToken, refreshToken, userJson] = await Promise.all([
      Preferences.get({ key: AuthService.KEY_ACCESS_TOKEN }),
      Preferences.get({ key: AuthService.KEY_REFRESH_TOKEN }),
      Preferences.get({ key: AuthService.KEY_USER }),
    ]);

    // Se manca uno qualsiasi dei tre, lo stato e' incoerente: pulisci tutto.
    if (!accessToken.value || !refreshToken.value || !userJson.value) {
      await this.clearStorage();
      return;
    }

    // Verifica che l'access token non sia gia scaduto localmente.
    const expiresAt = AuthService.decodeJwtExpiration(accessToken.value);
    const isExpired = expiresAt !== null && expiresAt < Date.now();

    if (isExpired) {
      // Access token scaduto: in teoria potremmo provare a refresharlo qui,
      // ma per semplicita lasciamo che il flusso normale lo faccia alla
      // prima richiesta. Per ora, manteniamo i token in memoria.
      // Il refreshInterceptor li rinnovera al primo 401.
    }

    // Carica tutto in memoria e aggiorna i Signal
    try {
      const user: AuthenticatedUser = JSON.parse(userJson.value);
      this.accessTokenCache = accessToken.value;
      this.refreshTokenCache = refreshToken.value;
      this._currentUser.set(user);
    } catch {
      // JSON corrotto: pulisci tutto
      await this.clearStorage();
    }
  }

  /**
   * Verifica la raggiungibilita del backend chiamando /health.
   * Chiamato da provideAppInitializer.
   *
   * @returns true se il backend risponde, false altrimenti.
   */
  async checkBackendHealth(): Promise<boolean> {
    try {
      // Il timeout di default di HttpClient e' troppo lungo (~2 minuti).
      // Usiamo fetch nativo con AbortController per un timeout corto.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(environment.healthCheckUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // 7. API PUBBLICA UTILITY (per gli interceptor)
  // ===========================================================================

  /**
   * Ritorna l'access token corrente in modo sincrono.
   * Usato dall'authInterceptor per allegare l'header Authorization.
   *
   * @returns access token JWT, o null se non autenticato.
   */
  getAccessToken(): string | null {
    return this.accessTokenCache;
  }

  /**
   * Ritorna il refresh token corrente in modo sincrono.
   * Usato dal refreshInterceptor.
   *
   * @returns refresh token, o null se non autenticato.
   */
  getRefreshToken(): string | null {
    return this.refreshTokenCache;
  }

  // ===========================================================================
  // 8. METODI PRIVATI — GESTIONE STORAGE
  // ===========================================================================

  /**
   * Gestisce il successo di register/login: persiste tokens e user, aggiorna
   * il Signal currentUser.
   */
  private async handleAuthSuccess(response: AuthResponse): Promise<void> {
    this.accessTokenCache = response.accessToken;
    this.refreshTokenCache = response.refreshToken;
    this._currentUser.set(response.user);

    await Promise.all([
      Preferences.set({
        key: AuthService.KEY_ACCESS_TOKEN,
        value: response.accessToken,
      }),
      Preferences.set({
        key: AuthService.KEY_REFRESH_TOKEN,
        value: response.refreshToken,
      }),
      Preferences.set({
        key: AuthService.KEY_USER,
        value: JSON.stringify(response.user),
      }),
    ]);
  }

  /**
   * Gestisce il successo di refresh: aggiorna entrambi i token (rotation),
   * lascia l'utente invariato.
   */
  private async handleRefreshSuccess(response: RefreshTokenResponse): Promise<void> {
    this.accessTokenCache = response.accessToken;
    this.refreshTokenCache = response.refreshToken;

    await Promise.all([
      Preferences.set({
        key: AuthService.KEY_ACCESS_TOKEN,
        value: response.accessToken,
      }),
      Preferences.set({
        key: AuthService.KEY_REFRESH_TOKEN,
        value: response.refreshToken,
      }),
    ]);
  }

  /**
   * Gestisce il logout (sia volontario che forzato da 401): cancella tutto
   * lo stato locale.
   */
  private handleLogoutSuccess(): void {
    this.accessTokenCache = null;
    this.refreshTokenCache = null;
    this._currentUser.set(null);
    void this.clearStorage();
  }

  /**
   * Cancella tutti i dati di autenticazione da Preferences.
   */
  private async clearStorage(): Promise<void> {
    await Promise.all([
      Preferences.remove({ key: AuthService.KEY_ACCESS_TOKEN }),
      Preferences.remove({ key: AuthService.KEY_REFRESH_TOKEN }),
      Preferences.remove({ key: AuthService.KEY_USER }),
    ]);
  }

  // ===========================================================================
  // 9. UTILITY — DECODIFICA JWT
  // ===========================================================================

  /**
   * Decodifica un JWT e ritorna il timestamp di scadenza in millisecondi.
   *
   * NOTA: questa funzione NON valida la firma del token. Si limita a leggere
   * il payload (che e' base64-encoded ma non cifrato). La validazione della
   * firma e' competenza esclusiva del backend.
   *
   * @param token JWT da decodificare
   * @returns timestamp di scadenza in millisecondi (Date.now() compatible),
   *          oppure null se il token e' malformato.
   */
  private static decodeJwtExpiration(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1])) as { exp?: number };
      if (typeof payload.exp !== 'number') return null;

      // exp e' in secondi Unix, convertiamo in millisecondi
      return payload.exp * 1000;
    } catch {
      return null;
    }
  }
}
