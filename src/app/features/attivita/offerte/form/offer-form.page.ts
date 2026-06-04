import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonInput,
  IonTextarea,
  ToastController,
} from '@ionic/angular/standalone';
import { BusinessService } from '../../../../core/services/business/business.service';

/**
 * OfferFormPage — form unificato per creare e modificare un'offerta.
 *
 * Modalità create: nessun :id in route → POST /business/offers
 * Modalità edit: :id in route → PATCH /business/offers/{id}
 *
 * Naviga back dopo il submit.
 */
@Component({
  selector: 'app-offer-form',
  templateUrl: './offer-form.page.html',
  styleUrls: ['./offer-form.page.scss'],
  standalone: true,
  imports: [FormsModule, IonContent, IonButton, IonInput, IonTextarea],
})
export class OfferFormPage implements OnInit {
  private readonly businessService = inject(BusinessService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  protected readonly isEditMode = signal(false);
  protected readonly offerId = signal<string | null>(null);
  protected readonly saving = signal(false);

  // Campi form
  protected title = signal('');
  protected description = signal('');
  protected pointsCost = signal<number>(1);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.offerId.set(id);
      // Prepopola dai dati già in memoria (evita chiamata extra)
      const existing = this.businessService.offers().find((o) => o.id === id);
      if (existing) {
        this.title.set(existing.title);
        this.description.set(existing.description);
        this.pointsCost.set(existing.pointsCost);
      }
    }
  }

  async submit(): Promise<void> {
    const cost = Number(this.pointsCost());
    if (!this.title().trim() || !this.description().trim() || cost < 1) {
      await this.showToast('Compila tutti i campi correttamente.', 'warning');
      return;
    }

    this.saving.set(true);
    const body = {
      title: this.title().trim(),
      description: this.description().trim(),
      pointsCost: cost,
    };

    const action$ = this.isEditMode()
      ? this.businessService.updateOffer(this.offerId()!, body)
      : this.businessService.createOffer(body);

    action$.subscribe({
      next: async () => {
        this.saving.set(false);
        const msg = this.isEditMode()
          ? 'Offerta aggiornata con successo.'
          : 'Offerta creata con successo.';
        await this.showToast(msg, 'success');
        await this.router.navigate(['/attivita/offerte']);
      },
      error: async (err) => {
        this.saving.set(false);
        const msg = err?.error?.message ?? 'Errore durante il salvataggio. Riprova.';
        await this.showToast(msg, 'danger');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/attivita/offerte']);
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 2500,
      position: 'bottom',
    });
    await toast.present();
  }
}
