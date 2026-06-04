import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonItemSliding,
  IonItem,
  IonItemOptions,
  IonItemOption,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline } from 'ionicons/icons';
import { BusinessService } from '../../../core/services/business/business.service';
import { Offer } from '../../../core/services/business/business.types';

/**
 * OffertePage — lista delle offerte dell'attività.
 *
 * Mostra le offerte raggruppate per stato (active prima, archived in fondo).
 * Swipe-to-delete per archiviare via DELETE /business/offers/{id}.
 * FAB in basso destra per creare una nuova offerta.
 */
@Component({
  selector: 'app-offerte',
  templateUrl: './offerte.page.html',
  styleUrls: ['./offerte.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonItemSliding,
    IonItem,
    IonItemOptions,
    IonItemOption,
  ],
})
export class OffertePage implements OnInit {
  protected readonly businessService = inject(BusinessService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  constructor() {
    addIcons({ addOutline, trashOutline });
  }

  ngOnInit(): void {
    this.businessService.loadOffers();
  }

  navigateToNew(): void {
    this.router.navigate(['/attivita/offerte/new']);
  }

  navigateToEdit(offer: Offer): void {
    this.router.navigate(['/attivita/offerte', offer.id]);
  }

  async archiveOffer(offer: Offer): Promise<void> {
    this.businessService.deleteOffer(offer.id).subscribe({
      next: async () => {
        await this.showToast('Offerta archiviata.', 'success');
      },
      error: async () => {
        await this.showToast("Errore durante l'archiviazione. Riprova.", 'danger');
      },
    });
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 2000,
      position: 'bottom',
    });
    await toast.present();
  }
}
