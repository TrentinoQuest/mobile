import { Component, OnInit, ViewChild, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonContent,
  IonToggle,
  ToggleCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosedOutline, trashOutline } from 'ionicons/icons';
import { Player, UserRole } from '@trentino-quest/shared-types';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PlayerProfileService } from '../../../core/services/player-profile/player-profile.service';
import { MapSettingsService } from '../../../core/services/map/map-settings.service';
import { HeadingService } from '../../../core/services/heading/heading.service';
import { ThemeSelectorComponent } from '../../../shared/components/theme-selector/theme-selector.component';
import { PlayerQrCardComponent } from '../components/player-qr-card/player-qr-card.component';

/** Soglie XP per i 10 livelli (indice = livello - 1). */
const XP_THRESHOLDS = [0, 200, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000];

const ITALIAN_MONTHS = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

interface SettingsRow {
  icon: string;
  label: string;
  value: string | null;
}

@Component({
  selector: 'app-profilo',
  templateUrl: './profilo.page.html',
  styleUrls: ['./profilo.page.scss'],
  standalone: true,
  imports: [IonContent, IonToggle, DecimalPipe, ThemeSelectorComponent, PlayerQrCardComponent],
})
export class ProfiloPage implements OnInit {
  @ViewChild(IonContent) private readonly content!: IonContent;

  private readonly authService = inject(AuthService);
  private readonly profileService = inject(PlayerProfileService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly mapSettings = inject(MapSettingsService);
  private readonly headingService = inject(HeadingService);

  /** Stato del toggle "ruota mappa con la bussola" (riflette le preferenze). */
  protected readonly rotateWithHeading = this.mapSettings.rotateWithHeading;

  constructor() {
    addIcons({ lockClosedOutline, trashOutline });
  }

  protected readonly player = computed<Player | null>(() => {
    const user = this.authService.currentUser();
    if (user?.role === UserRole.PLAYER) return user as Player;
    return null;
  });

  protected readonly username = computed(() => this.player()?.username ?? 'Esploratore');
  protected readonly playerId = computed(() => this.player()?.id ?? '');
  protected readonly totalPoints = computed(() => this.player()?.totalPoints ?? 0);
  protected readonly xp = computed(() => this.player()?.xp ?? 0);
  protected readonly level = computed(() => this.player()?.level ?? 1);
  protected readonly levelTitle = computed(() => this.player()?.levelTitle ?? '');
  protected readonly currentStreak = computed(() => this.player()?.currentStreak ?? 0);
  protected readonly longestStreak = computed(() => this.player()?.longestStreak ?? 0);
  protected readonly streakShieldActive = computed(() => this.player()?.streakShieldActive ?? false);

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

  protected readonly registrationSince = computed(() => {
    const date = this.player()?.registrationDate;
    if (!date) return '';
    const d = new Date(date);
    return `${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  protected readonly unlockedCount = this.profileService.unlockedCount;
  protected readonly totalCount = this.profileService.totalCount;

  protected settingsRows: SettingsRow[] = [
    { icon: 'bell', label: 'Notifiche', value: 'Tutti gli eventi' },
    { icon: 'layers', label: 'Mappa offline', value: '0 valli scaricate' },
    { icon: 'person', label: 'Account & privacy', value: null },
    { icon: 'compass', label: 'Lingua', value: 'Italiano' },
    { icon: 'info', label: 'Crediti & licenze', value: null },
  ];

  ngOnInit(): void {
    this.profileService.loadProgress();
    this.profileService.loadCollection();
  }

  async scrollToSettings(): Promise<void> {
    await this.content.scrollToBottom(400);
  }

  /**
   * Toggle "ruota la mappa con la bussola".
   * All'attivazione avvia il sensore bussola (gesto utente → su iOS questo
   * fa scattare il prompt di permesso). Se il sensore non e' disponibile o il
   * permesso e' negato, ripristina il toggle e avvisa.
   */
  async onToggleRotateMap(event: ToggleCustomEvent): Promise<void> {
    const enabled = event.detail.checked;

    if (enabled) {
      const ok = await this.headingService.start();
      if (!ok) {
        await this.mapSettings.setRotateWithHeading(false);
        const alert = await this.alertCtrl.create({
          header: 'Bussola non disponibile',
          message:
            'Non riesco ad accedere alla bussola del dispositivo. Controlla i permessi di movimento e orientamento nelle impostazioni del telefono.',
          buttons: ['Ho capito'],
        });
        await alert.present();
        return;
      }
    }

    await this.mapSettings.setRotateWithHeading(enabled);
  }

  async onSettingsRow(row: SettingsRow): Promise<void> {
    switch (row.icon) {
      case 'bell':
        await this.openNotifiche(row);
        break;
      case 'layers':
        await this.openMappaOffline();
        break;
      case 'person':
        await this.openAccountPrivacy();
        break;
      case 'compass':
        await this.openLingua(row);
        break;
      case 'info':
        await this.openCrediti();
        break;
    }
  }

  /** Crediti e licenze dei dati mappa (attribuzione OSM/OpenFreeMap). */
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

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/']);
  }

  // ----------------------------------------------------------------
  // Metodi privati per le azioni delle impostazioni
  // ----------------------------------------------------------------

  private async openNotifiche(row: SettingsRow): Promise<void> {
    const opzioni = ['Tutti gli eventi', 'Solo scoperte', 'Disattivate'];
    const alert = await this.alertCtrl.create({
      header: 'Notifiche',
      inputs: opzioni.map((opt) => ({
        type: 'radio' as const,
        label: opt,
        value: opt,
        checked: row.value === opt,
      })),
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (v: string) => {
            row.value = v;
          },
        },
      ],
    });
    await alert.present();
  }

  private async openMappaOffline(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Mappa offline',
      message:
        'Scarica le mappe delle valli del Trentino per esplorare anche senza connessione.\n\nNessuna valle disponibile al momento.',
      buttons: ['Chiudi'],
    });
    await alert.present();
  }

  private async openAccountPrivacy(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Account & privacy',
      buttons: [
        {
          text: 'Cambia password',
          icon: 'lock-closed-outline',
          handler: () => {
            void this.openCambiaPassword();
          },
        },
        {
          text: 'Elimina account',
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => {
            void this.confirmEliminaAccount();
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
        {
          text: 'Invia email',
          // TODO: chiamata API reset password quando l'endpoint sarà disponibile
          handler: () => {},
        },
      ],
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
          // TODO: chiamata API eliminazione account quando l'endpoint sarà disponibile
          handler: () => {
            this.logout();
          },
        },
      ],
    });
    await alert.present();
  }

  private async openLingua(row: SettingsRow): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Lingua',
      inputs: [
        { type: 'radio', label: 'Italiano', value: 'Italiano', checked: true },
        {
          type: 'radio',
          label: 'English (prossimamente)',
          value: 'English',
          disabled: true,
        },
        {
          type: 'radio',
          label: 'Deutsch (prossimamente)',
          value: 'Deutsch',
          disabled: true,
        },
      ],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (v: string) => {
            row.value = v;
          },
        },
      ],
    });
    await alert.present();
  }
}
