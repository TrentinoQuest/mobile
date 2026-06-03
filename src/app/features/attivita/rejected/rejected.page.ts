import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeCircleOutline, logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth/auth.service';

/**
 * RejectedPage — schermata per le attività il cui profilo è stato rifiutato.
 *
 * Mostrata dal businessStatusGuard quando approvalStatus === 'rejected'.
 * Non ha tab bar.
 */
@Component({
  selector: 'app-rejected',
  templateUrl: './rejected.page.html',
  styleUrls: ['./rejected.page.scss'],
  standalone: true,
  imports: [IonContent, IonButton, IonIcon],
})
export class RejectedPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    addIcons({ closeCircleOutline, logOutOutline });
  }

  async logout(): Promise<void> {
    this.authService.logout();
    await this.router.navigate(['/auth/login']);
  }
}
