import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline,
  scanOutline,
  checkmarkOutline,
  checkmarkCircle,
  closeOutline,
  closeCircle,
  timeOutline,
  ticketOutline,
  storefrontOutline,
  refreshOutline,
} from 'ionicons/icons';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import { firstValueFrom } from 'rxjs';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { BusinessService } from '../../../core/services/business/business.service';
import { CouponRedeemInfo } from '../../../core/services/business/business.types';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { extractErrorCode, extractErrorMessage } from '../../../core/utils/http-error';

/**
 * Stato della macchina del flusso cassiere:
 * - idle:      schermata iniziale, in attesa di scansione
 * - verifying: scansione fatta, GET di verifica in corso
 * - verified:  coupon verificato, mostra le info (riscattabile se active);
 *              il POST di riscatto avviene in-place (spinner nel bottone,
 *              signal `redeeming`) senza cambiare schermata
 * - success:   coupon riscattato con successo
 * - error:     errore di verifica/riscatto, con possibilità di riprovare
 */
type ScanState = 'idle' | 'verifying' | 'verified' | 'success' | 'error';

/** Messaggi UI per i codici errore applicativi della pipeline coupon. */
const COUPON_ERROR_MESSAGES: Record<string, string> = {
  COUPON_NOT_OWNED: 'Questo coupon appartiene a un’offerta di un’altra attività.',
  COUPON_ALREADY_REDEEMED: 'Coupon già riscattato.',
  COUPON_EXPIRED: 'Coupon scaduto.',
  INVALID_QR_TOKEN: 'QR non valido. Non è un coupon di Trentino Quest.',
};

/**
 * CouponScanPage — flusso di validazione coupon lato cassiere (ruolo business).
 *
 * Il cassiere scansiona il QR del coupon presentato dal giocatore, il client
 * verifica la validità (GET /market/business/redeem/{token}) e, se il coupon
 * è ancora `active` e appartiene a un'offerta dell'attività, consente il
 * riscatto (POST /market/business/redeem/{token}).
 *
 * Il QR contiene il token grezzo del coupon (stessa convenzione dello scanner
 * giocatore, vedi ScanService).
 */
@Component({
  selector: 'app-attivita-coupon-scan',
  templateUrl: './coupon-scan.page.html',
  styleUrls: ['./coupon-scan.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, DatePipe, TqButtonComponent],
})
export class CouponScanPage {
  private readonly businessService = inject(BusinessService);
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastController);

  protected readonly state = signal<ScanState>('idle');
  protected readonly coupon = signal<CouponRedeemInfo | null>(null);
  protected readonly errorMessage = signal<string>('');
  /** POST di riscatto in corso: spinner inline nel bottone "Riscatta". */
  protected readonly redeeming = signal(false);

  constructor() {
    addIcons({
      qrCodeOutline,
      scanOutline,
      checkmarkOutline,
      checkmarkCircle,
      closeOutline,
      closeCircle,
      timeOutline,
      ticketOutline,
      storefrontOutline,
      refreshOutline,
    });
  }

  /** Avvia lo scanner nativo e verifica il coupon scansionato. */
  async scan(): Promise<void> {
    const token = await this.openScanner();
    if (token === null) return; // utente ha annullato

    if (!token) {
      this.fail(COUPON_ERROR_MESSAGES['INVALID_QR_TOKEN']);
      return;
    }

    this.state.set('verifying');
    this.coupon.set(null);

    try {
      const info = await firstValueFrom(this.businessService.verifyCoupon(token));
      this.coupon.set(info);
      this.state.set('verified');
    } catch (err) {
      this.fail(this.messageFor(err));
    }
  }

  /** Riscatta il coupon verificato (abilitato solo se status === 'active'). */
  async redeem(): Promise<void> {
    const current = this.coupon();
    if (!current || current.status !== 'active' || this.redeeming()) return;

    this.redeeming.set(true);
    try {
      await firstValueFrom(this.businessService.redeemCoupon(current.token));
      void this.haptics.success();
      this.state.set('success');
    } catch (err) {
      this.fail(this.messageFor(err));
    } finally {
      this.redeeming.set(false);
    }
  }

  /** Torna allo stato iniziale per una nuova scansione. */
  reset(): void {
    this.coupon.set(null);
    this.errorMessage.set('');
    this.state.set('idle');
  }

  // ----------------------------------------------------------------
  // Helper privati
  // ----------------------------------------------------------------

  /**
   * Apre lo scanner nativo. Ritorna il token (stringa, eventualmente vuota)
   * oppure `null` se l'utente ha annullato.
   */
  private async openScanner(): Promise<string | null> {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
    });
    if (!result.ScanResult) return null; // stringa vuota = annullato (Capacitor)
    return result.ScanResult.trim();
  }

  private async fail(message: string): Promise<void> {
    void this.haptics.error();
    this.errorMessage.set(message);
    this.state.set('error');
    const t = await this.toast.create({ message, duration: 2500, color: 'danger' });
    await t.present();
  }

  private messageFor(err: unknown): string {
    const code = extractErrorCode(err);
    if (code && COUPON_ERROR_MESSAGES[code]) return COUPON_ERROR_MESSAGES[code];
    return extractErrorMessage(err) ?? 'Errore durante la verifica del coupon. Riprova.';
  }
}
