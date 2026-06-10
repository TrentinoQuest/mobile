import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonInput,
  IonTextarea,
  ToastController,
} from '@ionic/angular/standalone';
import { TqButtonComponent } from '../../../../shared/components/tq-button/tq-button.component';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
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
  imports: [FormsModule, IonContent, IonIcon, IonInput, IonTextarea, TqButtonComponent],
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

  // True dopo il primo prefill in edit mode: evita di sovrascrivere le
  // modifiche dell'utente quando il signal offers si aggiorna.
  private prefilled = false;

  constructor() {
    addIcons({ arrowBackOutline });

    // Prefill reattivo: copre sia il caso "offerte gia' in memoria" sia il
    // deep link a freddo, dove le offerte arrivano dopo loadOffers().
    effect(() => {
      const id = this.offerId();
      if (!id || this.prefilled) return;
      const existing = this.businessService.offers().find((o) => o.id === id);
      if (existing) {
        this.prefilled = true;
        this.title.set(existing.title);
        this.description.set(existing.description);
        this.pointsCost.set(existing.pointsCost);
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.offerId.set(id);
      // Deep link a freddo: se le offerte non sono in memoria, caricale
      // (skip automatico se gia' inizializzate).
      this.businessService.loadOffers();
    }
  }

  async submit(): Promise<void> {
    const cost = Math.round(Number(this.pointsCost()));
    if (!this.title().trim() || !this.description().trim() || !Number.isFinite(cost) || cost < 1) {
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
    void this.router.navigate(['/attivita/offerte']);
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
