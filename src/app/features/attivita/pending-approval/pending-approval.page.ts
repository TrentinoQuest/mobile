import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { addIcons } from 'ionicons';
import { timeOutline, logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth/auth.service';

/**
 * PendingApprovalPage — schermata di attesa per le attività in stato "pending".
 *
 * Mostrata dal businessStatusGuard quando approvalStatus === 'pending'.
 * Non ha tab bar: l'utente non può navigare finché non è approvato.
 */
@Component({
  selector: 'app-pending-approval',
  templateUrl: './pending-approval.page.html',
  styleUrls: ['./pending-approval.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, TqButtonComponent],
})
export class PendingApprovalPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    addIcons({ timeOutline, logOutOutline });
  }

  async logout(): Promise<void> {
    this.authService.logout();
    await this.router.navigate(['/auth/login']);
  }
}
