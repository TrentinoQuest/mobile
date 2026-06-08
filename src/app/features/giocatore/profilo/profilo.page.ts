import { AfterViewInit, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  ActionSheetController,
  AlertController,
  IonContent,
  IonIcon,
  IonToggle,
  ToggleCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  people,
  flash,
  trendingUp,
  flame,
  albums,
  trophy,
  shieldCheckmark,
  logOut,
  trash,
  person,
  notifications,
  volumeMedium,
  map,
  lockClosed,
  language,
  informationCircle,
  chevronForward,
  moon,
} from 'ionicons/icons';
import { Player, UserRole } from '@trentino-quest/shared-types';
import type { LeagueCurrentView } from '@trentino-quest/shared-types';
import { LeagueTier } from '@trentino-quest/shared-types';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PlayerProfileService } from '../../../core/services/player-profile/player-profile.service';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';
import { TqBadgeComponent } from '../../../shared/components/tq-badge/tq-badge.component';
import { ThemeSelectorComponent } from '../../../shared/components/theme-selector/theme-selector.component';
import { environment } from '../../../../environments/environment';

// ─── Costanti ─────────────────────────────────────────────────────────────────

const XP_THRESHOLDS = [0, 200, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000];

const TIER_LABEL: Record<LeagueTier, string> = {
  [LeagueTier.PORFIDO]: 'Lega Porfido',
  [LeagueTier.MARMO]: 'Lega Marmo',
  [LeagueTier.ARENARIA]: 'Lega Arenaria',
  [LeagueTier.GRANITO]: 'Lega Granito',
  [LeagueTier.DOLOMITI]: 'Lega Dolomiti',
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#5A8A3A,#2F4A1F)',
  'linear-gradient(135deg,#8E6314,#4A3416)',
  'linear-gradient(135deg,#3A7A9A,#1F3A4A)',
  'linear-gradient(135deg,#7A3A9A,#3A1F4A)',
  'linear-gradient(135deg,#9A3A3A,#4A1F1F)',
  'linear-gradient(135deg,#3A9A8A,#1F4A3A)',
];

@Component({
  selector: 'app-profilo',
  templateUrl: './profilo.page.html',
  styleUrls: ['./profilo.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, IonToggle, DecimalPipe, TqBadgeComponent, ThemeSelectorComponent],
})
export class ProfiloPage implements OnInit, AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(PlayerProfileService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly haptics = inject(HapticsService);
  readonly audio = inject(AudioService);

  protected readonly TIER_LABEL = TIER_LABEL;

  // ── Player ────────────────────────────────────────────────────────────────
  protected readonly player = computed<Player | null>(() => {
    const user = this.auth.currentUser();
    if (user?.role === UserRole.PLAYER) return user as Player;
    return null;
  });

  protected readonly username = computed(() => this.player()?.username ?? 'Esploratore');
  protected readonly playerId = computed(() => this.player()?.id ?? '');
  protected readonly xp = computed(() => this.player()?.xp ?? 0);
  protected readonly level = computed(() => this.player()?.level ?? 1);
  protected readonly levelTitle = computed(() => this.player()?.levelTitle ?? '');
  protected readonly currentStreak = computed(() => this.player()?.currentStreak ?? 0);
  protected readonly longestStreak = computed(() => this.player()?.longestStreak ?? 0);
  protected readonly streakShieldActive = computed(
    () => this.player()?.streakShieldActive ?? false,
  );

  protected readonly xpToNextLevel = computed<number | null>(() => {
    const lvl = this.level();
    if (lvl >= 10) return null;
    return XP_THRESHOLDS[lvl] - this.xp();
  });

  protected readonly xpProgress = computed<number>(() => {
    const lvl = this.level();
    if (lvl >= 10) return 100;
    const start = XP_THRESHOLDS[lvl - 1];
    const end = XP_THRESHOLDS[lvl];
    return Math.round(((this.xp() - start) / (end - start)) * 100);
  });

  // Valore animato: parte da 0 e sale al reale via ngAfterViewInit
  protected readonly animatedXpProgress = signal(0);

  // ── Collezione ────────────────────────────────────────────────────────────
  protected readonly unlockedCount = this.profileService.unlockedCount;
  protected readonly totalCount = this.profileService.totalCount;

  // ── Lega ─────────────────────────────────────────────────────────────────
  protected readonly currentLeagueTier = signal<LeagueTier | null>(null);

  constructor() {
    addIcons({
      people,
      flash,
      trendingUp,
      flame,
      albums,
      trophy,
      shieldCheckmark,
      logOut,
      trash,
      person,
      notifications,
      volumeMedium,
      map,
      lockClosed,
      language,
      informationCircle,
      chevronForward,
      moon,
    });
  }

  ngOnInit(): void {
    this.profileService.loadProgress();
    this.profileService.loadCollection();
    this.http.get<LeagueCurrentView>(`${environment.apiUrl}/leagues/current`).subscribe({
      next: (data) => this.currentLeagueTier.set(data.tier),
      error: () => {},
    });
  }

  ngAfterViewInit(): void {
    // Piccolo delay per far scattare la transizione CSS
    setTimeout(() => this.animatedXpProgress.set(this.xpProgress()), 60);
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  protected avatarGradient(id: string): string {
    let seed = 0;
    for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) & 0xffffffff;
    return AVATAR_GRADIENTS[Math.abs(seed) % AVATAR_GRADIENTS.length];
  }

  protected avatarInitial(u: string): string {
    return u.charAt(0).toUpperCase();
  }

  // ── Azioni ────────────────────────────────────────────────────────────────

  protected navigateSocial(): void {
    void this.haptics.tapLight();
    void this.router.navigate(['/giocatore/lega']);
  }

  protected navigateCoop(): void {
    void this.haptics.tapLight();
    void this.router.navigate(['/giocatore/coop']);
  }

  protected onAudioToggle(event: ToggleCustomEvent): void {
    void this.haptics.tapLight();
    this.audio.setEnabled(event.detail.checked);
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/']);
  }

  // ── Impostazioni (alert/action sheet) ─────────────────────────────────────

  protected async onSettingsTap(key: string): Promise<void> {
    switch (key) {
      case 'profile':
        await this.openModificaProfilo();
        break;
      case 'notifications':
        await this.openNotifiche();
        break;
      case 'offline':
        await this.openMappaOffline();
        break;
      case 'privacy':
        await this.openPrivacy();
        break;
      case 'language':
        await this.openLingua();
        break;
      case 'credits':
        await this.openCrediti();
        break;
      case 'delete':
        await this.confirmEliminaAccount();
        break;
    }
  }

  private async openModificaProfilo(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Modifica profilo',
      message: 'La modifica del profilo sarà disponibile prossimamente.',
      buttons: ['Chiudi'],
    });
    await alert.present();
  }

  private async openNotifiche(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Notifiche',
      inputs: [
        { type: 'radio', label: 'Tutti gli eventi', value: 'all', checked: true },
        { type: 'radio', label: 'Solo scoperte', value: 'discoveries' },
        { type: 'radio', label: 'Disattivate', value: 'off' },
      ],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Salva', handler: () => {} },
      ],
    });
    await alert.present();
  }

  private async openMappaOffline(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Mappe offline',
      message: 'Nessuna mappa scaricata. Questa funzionalità sarà disponibile prossimamente.',
      buttons: ['Chiudi'],
    });
    await alert.present();
  }

  private async openPrivacy(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Privacy',
      buttons: [
        {
          text: 'Cambia password',
          icon: 'lock-closed-outline',
          handler: () => {
            void this.openCambiaPassword();
          },
        },
        { text: 'Annulla', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async openCambiaPassword(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cambia password',
      message:
        "Ti invieremo un link per reimpostare la password all'indirizzo email associato al tuo account.",
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Invia email', handler: () => {} },
      ],
    });
    await alert.present();
  }

  private async openLingua(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Lingua',
      inputs: [
        { type: 'radio', label: 'Italiano', value: 'it', checked: true },
        { type: 'radio', label: 'English (prossimamente)', value: 'en', disabled: true },
        { type: 'radio', label: 'Deutsch (prossimamente)', value: 'de', disabled: true },
      ],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Salva', handler: () => {} },
      ],
    });
    await alert.present();
  }

  private async openCrediti(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Crediti & licenze',
      message:
        'Dati cartografici © OpenStreetMap contributors (ODbL).\n' +
        'Tile vettoriali servite da OpenFreeMap.\n\n' +
        'Trentino Quest · v 1.0.0',
      buttons: ['Chiudi'],
    });
    await alert.present();
  }

  private async confirmEliminaAccount(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Elimina account',
      message:
        'Questa azione è irreversibile. Tutti i tuoi progressi e collezionabili andranno persi.',
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          role: 'destructive',
          handler: () => {
            this.logout();
          },
        },
      ],
    });
    await alert.present();
  }
}
