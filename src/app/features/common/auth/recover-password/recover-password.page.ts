import { Component } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

/**
 * Pagina di recupero password.
 *
 * STUB: pagina placeholder. L'implementazione completa (form email,
 * chiamata a /auth/password-recovery, conferma invio) verra in una
 * fase successiva del progetto.
 */
@Component({
  selector: 'app-recover-password',
  templateUrl: './recover-password.page.html',
  styleUrls: ['./recover-password.page.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent],
})
export class RecoverPasswordPage {}
