import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { PlayerClass } from '@trentino-quest/shared-types';
import { environment } from '../../../../environments/environment';

/**
 * OnboardingService — classe iniziale e completamento del flusso di onboarding.
 *
 * Espone le due chiamate del CLAUDE.md (PATCH /player/me/class e
 * POST /onboarding/complete) e gestisce il flag locale "onboarding visto"
 * via Preferences di Capacitor, usato per non riproporre il flusso a un
 * ospite che lo ha gia' affrontato.
 *
 * Stile HTTP coerente con AuthService (HttpClient diretto, niente repository:
 * sono due scritture semplici senza stato condiviso da astrarre).
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly http = inject(HttpClient);

  /** Chiave Preferences del flag "onboarding gia' visto". */
  private static readonly KEY_SEEN = 'tq_onboarding_seen';

  /** Imposta la classe del giocatore. Endpoint: PATCH /player/me/class. */
  setPlayerClass(playerClass: PlayerClass): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/player/me/class`, { playerClass });
  }

  /** Completa l'onboarding lato server. Endpoint: POST /onboarding/complete. */
  complete(playerClass: PlayerClass): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/onboarding/complete`, { playerClass });
  }

  /** True se l'ospite ha gia' visto/affrontato l'onboarding su questo device. */
  async hasSeen(): Promise<boolean> {
    const { value } = await Preferences.get({ key: OnboardingService.KEY_SEEN });
    return value === 'true';
  }

  /** Segna l'onboarding come visto, per non riproporlo all'apertura. */
  async markSeen(): Promise<void> {
    await Preferences.set({ key: OnboardingService.KEY_SEEN, value: 'true' });
  }
}
