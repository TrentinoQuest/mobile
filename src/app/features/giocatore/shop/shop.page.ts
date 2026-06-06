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
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';
import { TqBadgeComponent } from '../../../shared/components/tq-badge/tq-badge.component';
import { environment } from '../../../../environments/environment';
import QRCode from 'qrcode';

type ShopTab = 'offerte' | 'coupon';
type CouponStatus = 'active' | 'redeemed' | 'expired';

interface OfferWithRemaining {
  id: string;
  businessId: string;
  title: string;
  description: string;
  pointsCost: number;
  status: string;
  createdAt: string;
  businessName: string;
  businessType: string;
  businessAddress: string;
  remaining: number | null;
}

interface CouponView {
  id: string;
  offerId: string;
  offerTitle?: string;
  businessName?: string;
  token: string;
  pointsCost: number;
  status: CouponStatus;
  purchasedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
}

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
    if (tab === 'coupon' && this.coupons().length === 0) {
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
        this.coupons.update((prev) => [coupon, ...prev]);
        this.setTab('coupon');
        await this.openCoupon(coupon);
      },
      error: async (err) => {
        this.purchasing.set(null);
        void this.haptics.error();
        void this.audio.playError();
        const code = (err?.error?.code as string | undefined) ?? '';
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
        this.activeCoupon.update((c) => (c ? { ...c, status: 'expired' } : c));
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
