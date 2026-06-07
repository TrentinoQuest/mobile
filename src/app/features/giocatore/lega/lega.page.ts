import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  ActionSheetController,
  ToastController,
} from '@ionic/angular/standalone';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  diamondOutline,
  diamond,
  flameOutline,
  flame,
  star,
  personOutline,
  personAddOutline,
  peopleOutline,
  closeOutline,
  checkmarkOutline,
  searchOutline,
  trashOutline,
  trophyOutline,
  chevronForward,
} from 'ionicons/icons';
import { LeagueTier } from '@trentino-quest/shared-types';
import type { LeagueCurrentView, LeagueMemberView } from '@trentino-quest/shared-types';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { environment } from '../../../../environments/environment';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type LegaTab = 'classifica' | 'amici';

interface Friend {
  friendshipId: string;
  playerId: string;
  username: string;
}

interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  username: string;
  createdAt: string;
}

interface PlayerSearchResult {
  playerId: string;
  username: string;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const TIER_ICONS: Record<LeagueTier, string> = {
  [LeagueTier.PORFIDO]: 'diamond-outline',
  [LeagueTier.MARMO]: 'diamond',
  [LeagueTier.ARENARIA]: 'flame-outline',
  [LeagueTier.GRANITO]: 'flame',
  [LeagueTier.DOLOMITI]: 'star',
};

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
  imports: [IonContent, IonIcon, NgClass, FormsModule, TqButtonComponent],
})
export class LegaPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly toastCtrl = inject(ToastController);

  protected readonly LeagueTier = LeagueTier;
  protected readonly TIER_ICONS = TIER_ICONS;
  protected readonly TIER_LABEL = TIER_LABEL;

  // ── Tab ───────────────────────────────────────────────────────────────────
  protected readonly activeTab = signal<LegaTab>('classifica');

  // ── Lega ──────────────────────────────────────────────────────────────────
  protected readonly leagueLoading = signal(false);
  protected readonly current = signal<LeagueCurrentView | null>(null);

  // ── Amici ─────────────────────────────────────────────────────────────────
  protected readonly friendsLoading = signal(false);
  protected readonly requestsLoading = signal(false);
  protected readonly friends = signal<Friend[]>([]);
  protected readonly requests = signal<FriendRequest[]>([]);
  protected readonly requestsBadge = computed(() => this.requests().length);

  // ── Ricerca amici ─────────────────────────────────────────────────────────
  protected readonly addFriendOpen = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<PlayerSearchResult[]>([]);
  protected readonly searchLoading = signal(false);
  protected readonly sentRequests = signal<Set<string>>(new Set());

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    addIcons({
      diamondOutline,
      diamond,
      flameOutline,
      flame,
      star,
      personOutline,
      personAddOutline,
      peopleOutline,
      closeOutline,
      checkmarkOutline,
      searchOutline,
      trashOutline,
      trophyOutline,
      chevronForward,
    });
  }

  ngOnInit(): void {
    this.loadCurrent();
    this.loadFriends();
    this.loadRequests();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TAB
  // ══════════════════════════════════════════════════════════════════════════

  protected setTab(tab: LegaTab): void {
    if (this.activeTab() === tab) return;
    void this.haptics.tapLight();
    this.activeTab.set(tab);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEGA
  // ══════════════════════════════════════════════════════════════════════════

  private loadCurrent(): void {
    this.leagueLoading.set(true);
    this.http.get<LeagueCurrentView>(`${environment.apiUrl}/leagues/current`).subscribe({
      next: (data) => {
        this.current.set(data);
        this.leagueLoading.set(false);
      },
      error: () => this.leagueLoading.set(false),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AMICI
  // ══════════════════════════════════════════════════════════════════════════

  private loadFriends(): void {
    this.friendsLoading.set(true);
    this.http.get<Friend[]>(`${environment.apiUrl}/social/friends`).subscribe({
      next: (data) => {
        this.friends.set(data);
        this.friendsLoading.set(false);
      },
      error: () => this.friendsLoading.set(false),
    });
  }

  private loadRequests(): void {
    this.requestsLoading.set(true);
    this.http.get<FriendRequest[]>(`${environment.apiUrl}/social/friends/requests`).subscribe({
      next: (data) => {
        this.requests.set(data);
        this.requestsLoading.set(false);
      },
      error: () => this.requestsLoading.set(false),
    });
  }

  protected acceptRequest(req: FriendRequest): void {
    void this.haptics.success();
    this.http
      .post(`${environment.apiUrl}/social/friends/${req.friendshipId}/accept`, {})
      .subscribe({
        next: async () => {
          this.requests.update((list) => list.filter((r) => r.friendshipId !== req.friendshipId));
          this.loadFriends();
          const t = await this.toastCtrl.create({
            message: 'Amicizia accettata!',
            duration: 2500,
            position: 'bottom',
            cssClass: 'tq-toast',
          });
          await t.present();
        },
        error: () => {},
      });
  }

  protected rejectRequest(req: FriendRequest): void {
    void this.haptics.dismiss();
    this.http
      .post(`${environment.apiUrl}/social/friends/${req.friendshipId}/reject`, {})
      .subscribe({
        next: () => {
          this.requests.update((list) => list.filter((r) => r.friendshipId !== req.friendshipId));
        },
        error: () => {},
      });
  }

  protected async friendTap(friend: Friend): Promise<void> {
    void this.haptics.tapLight();
    const sheet = await this.actionSheet.create({
      header: friend.username,
      buttons: [
        {
          text: 'Sfida co-op',
          icon: 'trophy-outline',
          handler: () => {
            void this.router.navigate(['/giocatore/coop'], {
              state: { partnerId: friend.playerId, partnerUsername: friend.username },
            });
          },
        },
        {
          text: 'Rimuovi amico',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => {
            void this.haptics.dismiss();
            this.http
              .delete(`${environment.apiUrl}/social/friends/${friend.friendshipId}`)
              .subscribe({
                next: async () => {
                  this.friends.update((list) =>
                    list.filter((f) => f.friendshipId !== friend.friendshipId),
                  );
                  const t = await this.toastCtrl.create({
                    message: `${friend.username} rimosso dagli amici`,
                    duration: 2500,
                    position: 'bottom',
                    cssClass: 'tq-toast',
                  });
                  await t.present();
                },
                error: () => {},
              });
          },
        },
        { text: 'Annulla', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RICERCA AMICI
  // ══════════════════════════════════════════════════════════════════════════

  protected openAddFriend(): void {
    void this.haptics.tapMedium();
    this.addFriendOpen.set(true);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  protected closeAddFriend(): void {
    void this.haptics.tapLight();
    this.addFriendOpen.set(false);
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  protected onSearchInput(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = this.searchQuery().trim();
    if (!q) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => this.doSearch(q), 400);
  }

  private doSearch(username: string): void {
    this.searchLoading.set(true);
    // Ricerca case-insensitive: query in minuscolo
    const q = username.toLowerCase();
    this.http
      .get<PlayerSearchResult[]>(`${environment.apiUrl}/players?username=${encodeURIComponent(q)}`)
      .subscribe({
        next: (data) => {
          this.searchResults.set(data);
          this.searchLoading.set(false);
        },
        error: () => {
          this.searchResults.set([]);
          this.searchLoading.set(false);
        },
      });
  }

  protected sendFriendRequest(player: PlayerSearchResult): void {
    void this.haptics.tapMedium();
    this.sentRequests.update((s) => new Set(s).add(player.playerId));
    this.http
      .post(`${environment.apiUrl}/social/friends/request`, { recipientId: player.playerId })
      .subscribe({
        error: () => {
          this.sentRequests.update((s) => {
            const n = new Set(s);
            n.delete(player.playerId);
            return n;
          });
        },
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER TEMPLATE
  // ══════════════════════════════════════════════════════════════════════════

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  }

  protected avatarGradient(id: string): string {
    let seed = 0;
    for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) & 0xffffffff;
    return AVATAR_GRADIENTS[Math.abs(seed) % AVATAR_GRADIENTS.length];
  }

  protected avatarInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  protected rowClasses(m: LeagueMemberView): Record<string, boolean> {
    return {
      'league-row': true,
      'league-row--me': m.isCurrentPlayer,
      'league-row--promotion': m.rank >= 1 && m.rank <= 5,
      'league-row--relegation': m.rank >= 26,
    };
  }
}
