// src/app/shared/components/permission-banner/permission-banner.component.ts
//
// Banner persistente che invita l'utente a riabilitare il permesso GPS
// quando questo e' stato negato.
//
// Si auto-mostra/nasconde leggendo lo stato dal GeolocationService:
// nessuna prop da passare dal parent, basta includere <tq-permission-banner />
// nel template della pagina dove vogliamo che sia visibile.
//
// Pattern signal-based: il componente reagisce automaticamente ai
// cambiamenti di permission() del service.

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonIcon, IonNote, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { locationOutline, settingsOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { GeolocationService } from '../../../core/services/geolocation/geolocation.service';

@Component({
  selector: 'app-permission-banner',
  standalone: true,
  imports: [IonButton, IonIcon, IonNote],
  templateUrl: './permission-banner.component.html',
  styleUrl: './permission-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionBannerComponent {
  private readonly geolocationService = inject(GeolocationService);
  private readonly toastController = inject(ToastController);

  /**
   * Loading state del bottone CTA: true mentre l'apertura impostazioni
   * e' in corso. Previene doppi click e da' feedback visivo all'utente.
   */
  protected readonly isOpening = signal(false);

  /**
   * Il banner e' visibile se e solo se il permesso e' stato negato.
   * Computed: reagisce automaticamente ai cambi di stato del service
   * (es. utente concede via impostazioni e torna nell'app: il watch
   * riparte, permission diventa 'granted', il banner sparisce).
   */
  protected readonly isVisible = computed(() => this.geolocationService.permission() === 'denied');

  constructor() {
    addIcons({ locationOutline, settingsOutline });
  }

  /**
   * Handler del bottone "Attiva GPS".
   *
   * Su native (Android/iOS): apre la pagina delle impostazioni dell'app
   * via capacitor-native-settings (Apple supporta ufficialmente solo
   * questa schermata su iOS).
   * Su web: mostra un toast che spiega come abilitare il permesso
   * dalle impostazioni del browser (non esiste API standard per aprire
   * le impostazioni browser in modo programmatico).
   */
  protected async onOpenSettings(): Promise<void> {
    this.isOpening.set(true);

    try {
      if (Capacitor.isNativePlatform()) {
        await NativeSettings.open({
          optionAndroid: AndroidSettings.ApplicationDetails,
          optionIOS: IOSSettings.App,
        });
      } else {
        const toast = await this.toastController.create({
          message:
            'Apri le impostazioni del browser per questo sito e concedi il permesso di posizione, poi ricarica la pagina.',
          duration: 6000,
          position: 'top',
          color: 'medium',
          buttons: [{ text: 'OK', role: 'cancel' }],
        });
        await toast.present();
      }
    } finally {
      this.isOpening.set(false);
    }
  }
}
