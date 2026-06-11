import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, pricetagsOutline, personOutline, qrCodeOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth/auth.service';

/**
 * Layout shell della sezione Attività Locale.
 *
 * Mostra la tab bar (Home, Offerte, Profilo) solo quando l'attività è approvata.
 * Le pagine /attivita/pending e /attivita/rejected usano questa shell ma
 * non mostrano la tab bar (il routing le raggiunge solo senza businessStatusGuard).
 *
 * La tab bar è nascosta via CSS per le route pending/rejected usando routerLinkActive.
 */
@Component({
  selector: 'app-attivita-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IonIcon],
})
export class AttivitaLayoutComponent {
  protected readonly authService = inject(AuthService);

  constructor() {
    addIcons({ homeOutline, pricetagsOutline, qrCodeOutline, personOutline });
  }
}
