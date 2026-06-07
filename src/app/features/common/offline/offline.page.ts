import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { from, interval, Subject, switchMap, takeUntil } from 'rxjs';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth/auth.service';

/**
 * OfflinePage — Pagina mostrata quando il backend non e' raggiungibile.
 *
 * Comportamento:
 * - Mostra un messaggio statico ("Sei offline") con un'icona evocativa.
 * - Esegue polling di /health ogni 5 secondi.
 * - Quando il backend torna disponibile, naviga automaticamente alla landing.
 * - Espone un bottone "Riprova" che forza un check immediato di /health.
 *
 * NOTA Ionic: usiamo i lifecycle ionViewWillEnter/ionViewWillLeave invece
 * di DestroyRef perche IonicRouteStrategy mantiene in cache le pagine
 * visitate. Una pagina "lasciata" non viene distrutta, e DestroyRef non
 * si attiverebbe. I lifecycle Ionic invece si attivano correttamente alla
 * navigazione via, permettendoci di fermare il polling.
 */
@Component({
  selector: 'app-offline',
  templateUrl: './offline.page.html',
  styleUrls: ['./offline.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, TqButtonComponent],
})
export class OfflinePage implements ViewWillEnter, ViewWillLeave {
  // ===========================================================================
  // Costanti
  // ===========================================================================

  private static readonly POLL_INTERVAL_MS = 5000;

  // ===========================================================================
  // Dependencies
  // ===========================================================================

  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  // ===========================================================================
  // Stato
  // ===========================================================================

  /** True quando l'utente ha cliccato "Riprova" e il check e' in corso. */
  readonly retrying = signal(false);

  /** Subject che emette quando dobbiamo fermare il polling corrente. */
  private stopPolling$ = new Subject<void>();

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  constructor() {
    addIcons({ 'cloud-offline-outline': cloudOfflineOutline });
  }

  /**
   * Hook Ionic chiamato quando la pagina sta per essere mostrata.
   * Avvia il polling.
   */
  ionViewWillEnter(): void {
    this.startHealthPolling();
  }

  /**
   * Hook Ionic chiamato quando la pagina sta per essere lasciata.
   * Ferma il polling per evitare chiamate inutili in background.
   */
  ionViewWillLeave(): void {
    this.stopPolling$.next();
  }

  // ===========================================================================
  // Azioni
  // ===========================================================================

  /**
   * Forza un check immediato di /health. Bypassa il timer del polling.
   * Se il backend risponde, naviga alla landing.
   */
  async retryNow(): Promise<void> {
    this.retrying.set(true);
    try {
      const isOnline = await this.authService.checkBackendHealth();
      if (isOnline) {
        await this.router.navigate(['/']);
      }
    } finally {
      this.retrying.set(false);
    }
  }

  // ===========================================================================
  // Polling
  // ===========================================================================

  /**
   * Avvia il polling periodico di /health. Si ferma quando emesso
   * stopPolling$, cioe' alla navigazione via dalla pagina.
   */
  private startHealthPolling(): void {
    interval(OfflinePage.POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => from(this.authService.checkBackendHealth())),
        takeUntil(this.stopPolling$),
      )
      .subscribe((isOnline) => {
        if (isOnline) {
          void this.router.navigate(['/']);
        }
      });
  }
}
