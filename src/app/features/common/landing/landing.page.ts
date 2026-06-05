import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { OnboardingService } from '../../../core/services/onboarding/onboarding.service';

/**
 * Landing page di Trentino Quest.
 *
 * Pagina pubblica di ingresso per utenti non autenticati. Layout immersivo
 * single-viewport, in chiave "gioco": brand forte, una riga che spiega cosa
 * fa l'app, due percorsi (esploratore / attivita locale) e link al login.
 *
 * Indirizza alla registrazione del ruolo:
 * - Esploratore     -> /onboarding (flusso 5 fasi che culmina nella registrazione)
 * - Attivita Locale -> /attivita/register
 *
 * All'apertura, se l'ospite non ha ancora visto l'onboarding, viene
 * reindirizzato automaticamente al flusso (GDD: mostra l'onboarding
 * all'apertura dell'app per i nuovi utenti).
 *
 * Markup volutamente senza ion-card/ion-button: usiamo elementi nativi con
 * routerLink per avere pieno controllo estetico col design system TQ.
 */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  standalone: true,
  imports: [RouterLink, IonContent],
})
export class LandingPage implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    const seen = await this.onboarding.hasSeen();
    if (!seen) {
      void this.router.navigate(['/onboarding'], { replaceUrl: true });
    }
  }
}
