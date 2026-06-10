import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IonContent, IonIcon, AlertController, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bagOutline,
  businessOutline,
  closeOutline,
  sparklesOutline,
  checkmarkCircle,
  closeCircle,
  timeOutline,
  ticketOutline,
  qrCodeOutline,
} from 'ionicons/icons';
import type {
  CouponView as SharedCouponView,
  OfferWithBusiness,
  OfferWithRemaining as SharedOfferWithRemaining,
} from '@trentino-quest/shared-types';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { extractErrorCode } from '../../../core/utils/http-error';
import { TqBadgeComponent } from '../../../shared/components/tq-badge/tq-badge.component';
import { environment } from '../../../../environments/environment';
import QRCode from 'qrcode';

type ShopTab = 'offerte' | 'coupon';

/**
 * Offerta del mercato come restituita da GET /market/offers: secondo lo
 * swagger e' OfferWithBusiness arricchita con `remaining`. (In shared-types
 * OfferWithRemaining estende solo Offer, senza anagrafica business: qui
 * serve la composizione.)
 */
type OfferWithRemaining = OfferWithBusiness & Pick<SharedOfferWithRemaining, 'remaining'>;

/**
 * CouponView con offerTitle/businessName opzionali, come da swagger
 * (in shared-types sono required ma il backend puo' ometterli).
 */
type CouponView = Omit<SharedCouponView, 'offerTitle' | 'businessName'> & {
  offerTitle?: string;
  businessName?: string;
};

type CouponStatus = CouponView['status'];

@Component({
  selector: 'app-shop',
  templateUrl: './shop.page.html',
  styleUrls: ['./shop.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, TqBadgeComponent],
})
export class ShopPage implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);
  private readonly authService = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  protected readonly activeTab = signal<ShopTab>('offerte');
  protected readonly offersLoading = signal(false);
  protected readonly couponsLoading = signal(false);
  protected readonly offers = signal<OfferWithRemaining[]>([]);
  protected readonly coupons = signal<CouponView[]>([]);
  protected readonly purchasing = signal<string | null>(null);
  protected readonly activeCoupon = signal<CouponView | null>(null);
  protected readonly qrDataUrl = signal('');
  protected readonly countdownText = signal('');
  protected readonly offersError = signal('');
  protected readonly purchaseBurst = signal(false);

  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly activeCoupons = computed(() =>
    this.coupons().filter((c) => c.status === 'active'),
  );
  protected readonly redeemedCoupons = computed(() =>
    this.coupons().filter((c) => c.status === 'redeemed'),
  );
  protected readonly expiredCoupons = computed(() =>
    this.coupons().filter((c) => c.status === 'expired'),
  );

  constructor() {
    addIcons({
      bagOutline,
      businessOutline,
      closeOutline,
      sparklesOutline,
      checkmarkCircle,
      closeCircle,
      timeOutline,
      ticketOutline,
      qrCodeOutline,
    });
  }

  ngOnInit(): void {
    this.loadOffers();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  protected setTab(tab: ShopTab): void {
    if (this.activeTab() === tab) return;
    void this.haptics.tapLight();
    this.activeTab.set(tab);
    if (tab === 'coupon') {
      this.loadCoupons();
    }
  }

  private loadOffers(): void {
    this.offersLoading.set(true);
    this.offersError.set('');
    this.http.get<OfferWithRemaining[]>(`${environment.apiUrl}/market/offers`).subscribe({
      next: (data) => {
        this.offers.set(data);
        this.offersLoading.set(false);
      },
      error: () => {
        this.offersError.set('Impossibile caricare le offerte.');
        this.offersLoading.set(false);
      },
    });
  }

  private loadCoupons(): void {
    this.couponsLoading.set(true);
    this.http.get<CouponView[]>(`${environment.apiUrl}/market/my-coupons`).subscribe({
      next: (data) => {
        this.coupons.set(data);
        this.couponsLoading.set(false);
      },
      error: () => this.couponsLoading.set(false),
    });
  }

  protected async purchaseOffer(offer: OfferWithRemaining): Promise<void> {
    if (this.purchasing()) return;
    void this.haptics.tapMedium();

    const alert = await this.alertCtrl.create({
      header: 'Conferma acquisto',
      message: `Acquistare "${offer.title}" per ${offer.pointsCost} monete?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Acquista',
          handler: () => {
            this.confirmPurchase(offer);
          },
        },
      ],
    });
    await alert.present();
  }

  private confirmPurchase(offer: OfferWithRemaining): void {
    this.purchasing.set(offer.id);
    void this.haptics.purchase();

    this.http.post<CouponView>(`${environment.apiUrl}/market/purchase/${offer.id}`, {}).subscribe({
      next: async (coupon) => {
        this.purchasing.set(null);
        void this.audio.playSuccess();
        this.purchaseBurst.set(true);
        setTimeout(() => this.purchaseBurst.set(false), 900);
        this.authService.deductPoints(offer.pointsCost);
        this.activeTab.set('coupon');
        this.loadCoupons();
        // Aggiorna anche le offerte: il campo remaining e' cambiato.
        this.loadOffers();
        await this.openCoupon(coupon);
      },
      error: async (err) => {
        this.purchasing.set(null);
        void this.haptics.error();
        void this.audio.playError();
        const code = extractErrorCode(err) ?? '';
        const msg =
          code === 'INSUFFICIENT_COINS'
            ? 'Monete insufficienti'
            : code === 'OFFER_SOLD_OUT'
              ? 'Offerta esaurita'
              : 'Acquisto non riuscito';
        const t = await this.toastCtrl.create({
          message: msg,
          duration: 3000,
          position: 'bottom',
          cssClass: 'tq-toast',
        });
        await t.present();
      },
    });
  }

  protected async openCoupon(coupon: CouponView): Promise<void> {
    this.activeCoupon.set(coupon);
    this.qrDataUrl.set('');
    this.startCountdown(coupon.expiresAt);

    try {
      const url = await QRCode.toDataURL(coupon.token, {
        width: 240,
        margin: 2,
        color: { dark: '#1a1a18', light: '#ffffff' },
      });
      this.qrDataUrl.set(url);
    } catch {
      // fallback: token visibile come testo
    }
  }

  protected closeCoupon(): void {
    void this.haptics.tapLight();
    this.activeCoupon.set(null);
    this.qrDataUrl.set('');
    this.stopCountdown();
  }

  private startCountdown(expiresAt: string): void {
    this.stopCountdown();
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        this.countdownText.set('Scaduto');
        this.stopCountdown();
        const expired = this.activeCoupon();
        this.activeCoupon.update((c) => (c ? { ...c, status: 'expired' } : c));
        // Mantieni coerente anche la lista coupon, non solo il dettaglio.
        if (expired) {
          this.coupons.update((list) =>
            list.map((c) => (c.id === expired.id ? { ...c, status: 'expired' as const } : c)),
          );
        }
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      this.countdownText.set(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    update();
    this.countdownInterval = setInterval(update, 1_000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  protected scarcityColor(remaining: number | null): string {
    if (remaining === null || remaining > 10) return 'var(--color-success)';
    if (remaining >= 5) return 'var(--color-warning)';
    return 'var(--color-error)';
  }

  protected scarcityPercent(remaining: number | null): number {
    if (remaining === null) return 100;
    return Math.min(100, (remaining / 50) * 100);
  }

  protected isLowStock(remaining: number | null): boolean {
    return remaining !== null && remaining <= 5;
  }

  protected statusBadgeColor(status: CouponStatus): 'success' | 'error' | 'primary' {
    if (status === 'active') return 'success';
    if (status === 'expired') return 'error';
    return 'primary';
  }

  protected statusLabel(status: CouponStatus): string {
    if (status === 'active') return 'Attivo';
    if (status === 'redeemed') return 'Usato';
    return 'Scaduto';
  }

  protected isCountdownCritical(): boolean {
    const text = this.countdownText();
    if (!text || text === 'Scaduto') return false;
    const [h, m] = text.split(':').map(Number);
    return h === 0 && m < 60;
  }
}
