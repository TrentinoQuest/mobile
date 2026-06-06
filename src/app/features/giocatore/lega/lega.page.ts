import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { NgClass } from '@angular/common';
import { addIcons } from 'ionicons';
import { diamondOutline, diamond, flameOutline, flame, star, personOutline } from 'ionicons/icons';
import { LeagueTier } from '@trentino-quest/shared-types';
import type {
  LeagueCurrentView,
  LeagueHistoryEntry,
  LeagueMemberView,
} from '@trentino-quest/shared-types';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { TqBadgeComponent } from '../../../shared/components/tq-badge/tq-badge.component';
import type { BadgeColor } from '../../../shared/components/tq-badge/tq-badge.component';
import { environment } from '../../../../environments/environment';

type LeagaTab = 'classifica' | 'storico';

// Mappa tier → icona Ionicons
const TIER_ICONS: Record<LeagueTier, string> = {
  [LeagueTier.PORFIDO]: 'diamond-outline',
  [LeagueTier.MARMO]: 'diamond',
  [LeagueTier.ARENARIA]: 'flame-outline',
  [LeagueTier.GRANITO]: 'flame',
  [LeagueTier.DOLOMITI]: 'star',
};

// Mappa tier → colore tema testuale
const TIER_LABEL: Record<LeagueTier, string> = {
  [LeagueTier.PORFIDO]: 'Lega Porfido',
  [LeagueTier.MARMO]: 'Lega Marmo',
  [LeagueTier.ARENARIA]: 'Lega Arenaria',
  [LeagueTier.GRANITO]: 'Lega Granito',
  [LeagueTier.DOLOMITI]: 'Lega Dolomiti',
};

// Gradienti avatar deterministici
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#5A8A3A,#2F4A1F)',
  'linear-gradient(135deg,#8E6314,#4A3416)',
  'linear-gradient(135deg,#3A7A9A,#1F3A4A)',
  'linear-gradient(135deg,#7A3A9A,#3A1F4A)',
  'linear-gradient(135deg,#9A3A3A,#4A1F1F)',
  'linear-gradient(135deg,#3A9A8A,#1F4A3A)',
];

const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const SHORT_MONTHS = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
];

@Component({
  selector: 'app-lega',
  templateUrl: './lega.page.html',
  styleUrls: ['./lega.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, NgClass, TqBadgeComponent],
})
export class LegaPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly haptics = inject(HapticsService);

  protected readonly LeagueTier = LeagueTier;
  protected readonly TIER_ICONS = TIER_ICONS;
  protected readonly TIER_LABEL = TIER_LABEL;

  protected readonly activeTab = signal<LeagaTab>('classifica');
  protected readonly loading = signal(false);
  protected readonly historyLoading = signal(false);

  protected readonly current = signal<LeagueCurrentView | null>(null);
  protected readonly history = signal<LeagueHistoryEntry[]>([]);
  protected readonly historyLoaded = signal(false);

  constructor() {
    addIcons({ diamondOutline, diamond, flameOutline, flame, star, personOutline });
  }

  ngOnInit(): void {
    this.loadCurrent();
  }

  protected setTab(tab: LeagaTab): void {
    if (this.activeTab() === tab) return;
    void this.haptics.tapLight();
    this.activeTab.set(tab);
    if (tab === 'storico' && !this.historyLoaded()) {
      this.loadHistory();
    }
  }

  private loadCurrent(): void {
    this.loading.set(true);
    this.http.get<LeagueCurrentView>(`${environment.apiUrl}/leagues/current`).subscribe({
      next: (data) => {
        this.current.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.http.get<LeagueHistoryEntry[]>(`${environment.apiUrl}/leagues/history`).subscribe({
      next: (data) => {
        this.history.set(data);
        this.historyLoading.set(false);
        this.historyLoaded.set(true);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  // Formatta "2024-06-03" → "Lun 3 Giu"
  protected formatDate(iso: string): string {
    const d = new Date(iso);
    return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  }

  // Gradiente avatar deterministico da playerId
  protected avatarGradient(playerId: string): string {
    let seed = 0;
    for (let i = 0; i < playerId.length; i++) {
      seed = (seed * 31 + playerId.charCodeAt(i)) & 0xffffffff;
    }
    return AVATAR_GRADIENTS[Math.abs(seed) % AVATAR_GRADIENTS.length];
  }

  // Iniziale username per avatar
  protected avatarInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  // Classi CSS per ogni riga classifica
  protected rowClasses(m: LeagueMemberView): Record<string, boolean> {
    return {
      'league-row': true,
      'league-row--me': m.isCurrentPlayer,
      'league-row--promotion': m.rank >= 1 && m.rank <= 5,
      'league-row--relegation': m.rank >= 26,
    };
  }

  // Colore badge storico
  protected historyBadgeColor(entry: LeagueHistoryEntry): BadgeColor {
    if (entry.promoted) return 'success';
    if (entry.relegated) return 'error';
    return 'primary';
  }

  protected historyBadgeLabel(entry: LeagueHistoryEntry): string {
    if (entry.promoted) return 'Promosso';
    if (entry.relegated) return 'Retrocesso';
    return 'Mantenuto';
  }
}
