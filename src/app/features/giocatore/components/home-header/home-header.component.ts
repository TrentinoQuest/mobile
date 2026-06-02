import { Component, computed, inject } from '@angular/core';
import { QuestService } from '../../../../core/services/quest/quest.service';
import { AuthService } from '../../../../core/services/auth/auth.service';

/**
 * Header overlay sopra la mappa nella Home Giocatore.
 *
 * Mostra:
 * 1. Saluto narrativo variabile con ora del giorno + username
 * 2. Collection chip: progress bar continua (collezione totale)
 * 3. Punti totali (secondario, sotto la barra)
 *
 * Posizionamento:
 * Si posiziona in absolute top sopra il container mappa della HomePage.
 * Background "glass" (gradient + blur) per coerenza con la tab bar.
 * La mappa traspare delicatamente sotto.
 *
 * Reattivita':
 * Consuma signal di QuestService (discoveredCount, totalCount,
 * playerPoints, loading). Niente input, niente output: si auto-sincronizza
 * via DI. Quando un signal cambia, il template si rerendera.
 *
 * Auth:
 * Username letto da AuthService.currentUser(). Se l'utente non e' un
 * Player (raro: la home e' protetta da authGuard con role check), usa
 * fallback "esploratore".
 *
 * TODO 2E: quando ci sara' il pulsante "centra su di me", potrebbe vivere
 * qui in alto a destra invece che come FAB separato. Da valutare in 2E.
 */
@Component({
  selector: 'app-home-header',
  templateUrl: './home-header.component.html',
  styleUrls: ['./home-header.component.scss'],
  standalone: true,
})
export class HomeHeaderComponent {
  private readonly questService = inject(QuestService);
  private readonly authService = inject(AuthService);

  // ----------------------------------------------------------------
  // Dati esposti al template (computed dai signal upstream)
  // ----------------------------------------------------------------

  /**
   * Saluto narrativo: "Buongiorno" / "Buon pomeriggio" / "Buonasera" /
   * "Buonanotte" in base all'ora del giorno.
   *
   * NOTE sul calcolo:
   * - Computed Angular: si ricalcola SOLO quando un signal letto cambia.
   *   Qui non legge alcun signal, quindi viene valutato UNA VOLTA al
   *   primo render del componente.
   * - Se l'utente tiene l'app aperta per ore attraverso il cambio di
   *   fascia oraria (es. da pomeriggio a sera), il saluto NON si aggiorna
   *   automaticamente. Edge case accettabile per ora (la home tipicamente
   *   non resta aperta cosi' a lungo).
   * - Per fix futuro: trasformare in signal aggiornato da setInterval
   *   ogni 30min, oppure ricalcolare a ogni ngOnInit.
   */
  protected readonly greeting = computed<string>(() => {
    const hour = new Date().getHours();
    if (hour < 6) return 'Buonanotte';
    if (hour < 13) return 'Buongiorno';
    if (hour < 18) return 'Buon pomeriggio';
    if (hour < 22) return 'Buonasera';
    return 'Buonanotte';
  });

  /**
   * Username del giocatore corrente, con fallback se non disponibile.
   * Legge il signal currentUser() di AuthService — reattivo a login/logout.
   */
  protected readonly username = computed<string>(() => {
    const user = this.authService.currentUser();
    // Type guard: il currentUser potrebbe essere Admin o Player.
    // Solo Player ha username; per gli altri ruoli mostriamo fallback.
    if (user && 'username' in user && typeof user.username === 'string') {
      return user.username;
    }
    return 'esploratore';
  });

  /** Quante quest il giocatore ha scoperto. */
  protected readonly discovered = this.questService.discoveredCount;

  /** Quante quest totali ci sono in lista. */
  protected readonly total = this.questService.totalCount;

  /** Punti totali del giocatore, letti dal profilo auth (aggiornati dopo ogni check-in/scan). */
  protected readonly points = computed<number>(() => {
    const user = this.authService.currentUser();
    if (user && 'totalPoints' in user) return (user as { totalPoints: number }).totalPoints;
    return 0;
  });

  /** Loading: usato per mostrare skeleton mentre i dati arrivano. */
  protected readonly loading = this.questService.loading;

  /**
   * Percentuale di completamento per la progress bar.
   * Computed: si aggiorna automaticamente quando discovered o total cambiano.
   *
   * Guard contro divisione per zero: se total === 0 (dati non caricati),
   * restituisce 0 invece di NaN.
   */
  protected readonly progressPercent = computed<number>(() => {
    const t = this.total();
    if (t === 0) return 0;
    return Math.round((this.discovered() / t) * 100);
  });
}
