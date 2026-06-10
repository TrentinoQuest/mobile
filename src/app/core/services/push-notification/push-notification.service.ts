import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PushNotifications } from '@capacitor/push-notifications';
import type { ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../auth/auth.service';
import { HapticsService } from '../haptics/haptics.service';
import { AudioService } from '../audio.service';

/**
 * Chiave Preferences per la preferenza notifiche scelta dal profilo:
 * 'all' (default) | 'off'. Quando 'off' i toast in foreground vengono
 * soppressi (le notifiche di sistema dipendono dai permessi OS).
 */
export const NOTIFICATIONS_PREF_KEY = 'tq_notifications_pref';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly auth = inject(AuthService);
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', ({ value }) => {
      this.auth.saveDeviceToken(value);
    });

    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        void this.handleForeground(notification);
      },
    );

    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      this.handleDeepLink(action);
    });
  }

  private async handleForeground(notification: PushNotificationSchema): Promise<void> {
    // Rispetta la preferenza notifiche scelta dall'utente nel profilo.
    const { value } = await Preferences.get({ key: NOTIFICATIONS_PREF_KEY });
    if (value === 'off') return;

    void this.haptics.tapLight();
    this.audio.playTap();

    const message = notification.body ?? notification.title ?? 'Nuova notifica';
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      position: 'top',
      cssClass: 'tq-toast',
      buttons: [{ icon: 'close-outline', role: 'cancel' }],
    });
    await toast.present();
  }

  private handleDeepLink(action: ActionPerformed): void {
    const type = action.notification.data?.['type'] as string | undefined;
    if (type === 'friend_request') void this.router.navigate(['/giocatore/lega']);
    else if (type === 'kudos') void this.router.navigate(['/giocatore/social']);
    else if (type === 'coop') void this.router.navigate(['/giocatore/coop']);
    else if (type === 'league') void this.router.navigate(['/giocatore/lega']);
  }
}
