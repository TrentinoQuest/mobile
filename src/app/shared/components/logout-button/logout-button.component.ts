import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth/auth.service';

/**
 * LogoutButton — Bottone di logout riutilizzabile.
 *
 * Da inserire nella toolbar delle pagine autenticate (home Giocatore,
 * home Attività, eventuali pagine profilo). Al click:
 * - Chiama AuthService.logout() che cancella i token in Preferences
 *   e notifica il backend (fire-and-forget).
 * - Naviga alla landing.
 *
 * Nessuna conferma esplicita: il logout non è distruttivo, l'utente
 * puo' sempre riautenticarsi.
 */
@Component({
  selector: 'app-logout-button',
  templateUrl: './logout-button.component.html',
  styleUrls: ['./logout-button.component.scss'],
  standalone: true,
  imports: [IonButton, IonIcon],
})
export class LogoutButtonComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    addIcons({ logOutOutline });
  }

  async onLogout(): Promise<void> {
    this.authService.logout();
    await this.router.navigate(['/']);
  }
}
