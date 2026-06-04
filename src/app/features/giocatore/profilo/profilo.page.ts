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

  protected readonly registrationSince = computed(() => {
    const date = this.player()?.registrationDate;
    if (!date) return '';
    const d = new Date(date);
    return `${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  protected readonly level = computed(() => {
    const pts = this.totalPoints();
    if (pts >= 5000) return 5;
    if (pts >= 2000) return 4;
    if (pts >= 1000) return 3;
    if (pts >= 500) return 2;
    return 1;
  });

  protected readonly unlockedCount = this.profileService.unlockedCount;
  protected readonly totalCount = this.profileService.totalCount;

  protected readonly achievements = [
    { icon: 'mountain', label: 'Primo borgo', unlocked: true },
    { icon: 'walk', label: '50 km in cammino', unlocked: true },
    { icon: 'leaf', label: 'Esploratore', unlocked: true },
    { icon: 'flame', label: '10 giorni', unlocked: false },
    { icon: 'star', label: 'Val di Non', unlocked: false },
  ];

  protected settingsRows: SettingsRow[] = [
    { icon: 'bell', label: 'Notifiche', value: 'Tutti gli eventi' },
    { icon: 'layers', label: 'Mappa offline', value: '0 valli scaricate' },
    { icon: 'person', label: 'Account & privacy', value: null },
    { icon: 'compass', label: 'Lingua', value: 'Italiano' },
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
    }
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/']);
  }

  protected achievementIcon(name: string): string {
    const icons: Record<string, string> = {
      mountain: 'M3 20l5-9 3 5 2-3 8 7H3z',
      walk: 'M13 4.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM9 21l2-6-3-3 2-4 4 1 3 3M14 12l3 2v6',
      leaf: 'M4 20c0-9 7-16 16-16 0 9-7 16-16 16zM4 20c4-4 8-8 16-16',
      flame: 'M12 3s-1 3-3 5-3 4-3 7a6 6 0 0012 0c0-2.5-1.5-4-2.5-6S13.5 6 12 3z',
      star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z',
    };
    return icons[name] ?? 'M12 12m-9 0a9 9 0 1018 0 9 9 0 00-18 0';
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
