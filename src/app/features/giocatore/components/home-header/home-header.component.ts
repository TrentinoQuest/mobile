import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { QuestService } from '../../../../core/services/quest/quest.service';
import { AuthService } from '../../../../core/services/auth/auth.service';

/**
 * HUD superiore della Home Giocatore.
 *
 * Barra compatta sopra la mappa con le sole informazioni che servono al
 * giocatore a colpo d'occhio:
 * 1. Collezione: quanti collezionabili scoperti su totale + mini progress bar
 * 2. Livello + punti totali
 *
 * Scelta di design: niente saluto narrativo ingombrante ("Buonasera...").
 * La mappa e' il campo da gioco e deve restare libera; questa barra occupa
 * solo una striscia in alto, rispettando la safe area (notch/Dynamic Island).
 *
 * Reattivita': consuma signal di QuestService e AuthService; si auto-aggiorna
 * dopo ogni scan/check-in senza input/output.
 */
@Component({
  selector: 'app-home-header',
  templateUrl: './home-header.component.html',
  styleUrls: ['./home-header.component.scss'],
  standalone: true,
  imports: [DecimalPipe],
})
export class HomeHeaderComponent {
  private readonly questService = inject(QuestService);
  private readonly authService = inject(AuthService);

  /** Quanti collezionabili/quest il giocatore ha scoperto. */
  protected readonly discovered = this.questService.discoveredCount;

  /** Totale collezionabili/quest in lista. */
  protected readonly total = this.questService.totalCount;

  /** Loading: skeleton mentre arrivano i primi dati. */
  protected readonly loading = this.questService.loading;

  /** Punti totali del giocatore (aggiornati dopo ogni scan/check-in). */
  protected readonly points = computed<number>(() => {
    const user = this.authService.currentUser();
    if (user && 'totalPoints' in user) return (user as { totalPoints: number }).totalPoints;
    return 0;
  });

  /** Livello derivato dai punti (stesse soglie del profilo). */
  protected readonly level = computed<number>(() => {
    const pts = this.points();
    if (pts >= 5000) return 5;
    if (pts >= 2000) return 4;
    if (pts >= 1000) return 3;
    if (pts >= 500) return 2;
    return 1;
  });

  /**
   * Percentuale di completamento per la mini progress bar.
   * Guard contro divisione per zero quando i dati non sono ancora arrivati.
   */
  protected readonly progressPercent = computed<number>(() => {
    const t = this.total();
    if (t === 0) return 0;
    return Math.round((this.discovered() / t) * 100);
  });
}
