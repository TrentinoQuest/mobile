import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonInput,
  IonSelect,
  IonSelectOption,
  ToastController,
} from '@ionic/angular/standalone';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { BusinessService } from '../../../core/services/business/business.service';
import { BusinessType, BUSINESS_TYPE_LABEL } from '../../../core/services/business/business.types';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';

/**
 * ProfiloPage — form di modifica del profilo aziendale.
 *
 * Al caricamento prepopola i campi dal BusinessService.
 * Al submit invia PATCH /business/me e mostra toast di conferma/errore.
 */
@Component({
  selector: 'app-attivita-profilo',
  templateUrl: './profilo.page.html',
  styleUrls: ['./profilo.page.scss'],
  standalone: true,
  imports: [FormsModule, IonContent, IonInput, IonSelect, IonSelectOption, TqButtonComponent],
})
export class AttivitaProfiloPage implements OnInit {
  protected readonly businessService = inject(BusinessService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  // Campi form legati via ngModel
  protected businessName = signal('');
  protected businessType = signal<BusinessType>(BusinessType.RESTAURANT);
  protected address = signal('');
  protected saving = signal(false);

  // Etichette per il select tipo attività
  protected readonly businessTypes: { value: BusinessType; label: string }[] = Object.entries(
    BUSINESS_TYPE_LABEL,
  ).map(([value, label]) => ({ value: value as BusinessType, label }));

  constructor() {
    addIcons({ logOutOutline });
    // Prepopola il form appena il profilo è disponibile
    effect(() => {
      const profile = this.businessService.profile();
      if (profile) {
        this.businessName.set(profile.businessName);
        this.businessType.set(profile.businessType);
        this.address.set(profile.address);
      }
    });
  }

  ngOnInit(): void {
    this.businessService.loadProfile();
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.businessService
      .updateProfile({
        businessName: this.businessName(),
        businessType: this.businessType(),
        address: this.address(),
      })
      .subscribe({
        next: async () => {
          this.saving.set(false);
          await this.showToast('Profilo aggiornato con successo.', 'success');
        },
        error: async (err) => {
          this.saving.set(false);
          const msg = err?.error?.message ?? 'Errore durante il salvataggio. Riprova.';
          await this.showToast(msg, 'danger');
        },
      });
  }

  async logout(): Promise<void> {
    this.authService.logout();
    this.businessService.reset();
    await this.router.navigate(['/auth/login']);
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 2500,
      position: 'bottom',
    });
    await toast.present();
  }
}
