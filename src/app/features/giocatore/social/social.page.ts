import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  IonContent,
  IonIcon,
  ActionSheetController,
  ToastController,
} from '@ionic/angular/standalone';
import { NgClass } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  heartOutline,
  heart,
  personAddOutline,
  peopleOutline,
  closeOutline,
  checkmarkOutline,
  checkmarkCircle,
  wineOutline,
  starOutline,
  searchOutline,
  personOutline,
  trashOutline,
  trophyOutline,
} from 'ionicons/icons';
import { FormsModule } from '@angular/forms';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';
import { TqBadgeComponent } from '../../../shared/components/tq-badge/tq-badge.component';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { environment } from '../../../../environments/environment';

type SocialTab = 'feed' | 'amici' | 'richieste';
type KudosEmoji = 'beer' | 'highfive' | 'star';

interface FeedActivityItem {
  type: 'quest_completion' | 'collectible_unlock';
  playerId: string;
  username: string;
  questName?: string;
  collectibleName?: string;
  collectibleRarity?: string;
  timestamp: string;
  activityId: string;
  kudosCount: number;
  myKudos: boolean;
}

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

// Gradienti avatar deterministici (stessa palette di lega.page.ts)
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#5A8A3A,#2F4A1F)',
  'linear-gradient(135deg,#8E6314,#4A3416)',
  'linear-gradient(135deg,#3A7A9A,#1F3A4A)',
  'linear-gradient(135deg,#7A3A9A,#3A1F4A)',
  'linear-gradient(135deg,#9A3A3A,#4A1F1F)',
  'linear-gradient(135deg,#3A9A8A,#1F4A3A)',
];

@Component({
  selector: 'app-social',
  templateUrl: './social.page.html',
  styleUrls: ['./social.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, NgClass, FormsModule, TqBadgeComponent, TqButtonComponent],
})
export class SocialPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly toastCtrl = inject(ToastController);

  protected readonly activeTab = signal<SocialTab>('feed');
  protected readonly feedLoading = signal(false);
  protected readonly friendsLoading = signal(false);
  protected readonly requestsLoading = signal(false);
  protected readonly feed = signal<FeedActivityItem[]>([]);
  protected readonly friends = signal<Friend[]>([]);
  protected readonly requests = signal<FriendRequest[]>([]);

  // kudos: set degli activityId in volo + mappa ottimistica
  protected readonly pendingKudos = signal<Set<string>>(new Set());
  protected readonly optimisticKudos = signal<Map<string, boolean>>(new Map());

  // ricerca amici
  protected readonly addFriendOpen = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<PlayerSearchResult[]>([]);
  protected readonly searchLoading = signal(false);
  protected readonly sentRequests = signal<Set<string>>(new Set());

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly requestsBadge = computed(() => this.requests().length);

  protected readonly myKudosFor = (activityId: string): boolean =>
    this.optimisticKudos().get(activityId) ??
    this.feed().find((f) => f.activityId === activityId)?.myKudos ??
    false;

  protected readonly kudosCountFor = (item: FeedActivityItem): number => {
    const optimistic = this.optimisticKudos().get(item.activityId);
    if (optimistic === true && !item.myKudos) return item.kudosCount + 1;
    if (optimistic === false && item.myKudos) return item.kudosCount - 1;
    return item.kudosCount;
  };

  constructor() {
    addIcons({
      heartOutline,
      heart,
      personAddOutline,
      peopleOutline,
      closeOutline,
      checkmarkOutline,
      checkmarkCircle,
      wineOutline,
      starOutline,
      searchOutline,
      personOutline,
      trashOutline,
      trophyOutline,
    });
  }

  ngOnInit(): void {
    this.loadFeed();
    this.loadRequests();
  }

  protected setTab(tab: SocialTab): void {
    if (this.activeTab() === tab) return;
    void this.haptics.tapLight();
    this.activeTab.set(tab);
    if (tab === 'amici' && this.friends().length === 0) this.loadFriends();
    if (tab === 'richieste') this.loadRequests();
  }

  private loadFeed(): void {
    this.feedLoading.set(true);
    this.http
      .get<FeedActivityItem[]>(`${environment.apiUrl}/social/feed?limit=20&offset=0`)
      .subscribe({
        next: (data) => {
          this.feed.set(data);
          this.feedLoading.set(false);
        },
        error: () => this.feedLoading.set(false),
      });
  }

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

  // Tap kudos — invia con emoji highfive di default
  protected sendKudos(item: FeedActivityItem): void {
    if (this.pendingKudos().has(item.activityId)) return;
    if (this.myKudosFor(item.activityId)) return;

    void this.haptics.kudosSent();
    void this.audio.playTap();

    // aggiornamento ottimistico
    this.optimisticKudos.update((m) => new Map(m).set(item.activityId, true));

    this.pendingKudos.update((s) => new Set(s).add(item.activityId));

    this.http
      .post(`${environment.apiUrl}/social/kudos`, {
        toPlayerId: item.playerId,
        activityType: item.type,
        activityId: item.activityId,
        emoji: 'highfive' as KudosEmoji,
      })
      .subscribe({
        next: () => {
          this.pendingKudos.update((s) => {
            const n = new Set(s);
            n.delete(item.activityId);
            return n;
          });
        },
        error: () => {
          // rollback
          this.optimisticKudos.update((m) => {
            const n = new Map(m);
            n.delete(item.activityId);
            return n;
          });
          this.pendingKudos.update((s) => {
            const n = new Set(s);
            n.delete(item.activityId);
            return n;
          });
        },
      });
  }

  // Long press kudos — apre selettore emoji
  protected async openKudosSelector(item: FeedActivityItem): Promise<void> {
    if (this.myKudosFor(item.activityId)) return;
    void this.haptics.tapLight();

    const sheet = await this.actionSheet.create({
      header: 'Tipo di kudos',
      buttons: [
        {
          text: 'Cin cin',
          icon: 'wine-outline',
          handler: () => this.sendKudosWithEmoji(item, 'beer'),
        },
        {
          text: 'High five',
          icon: 'people-outline',
          handler: () => this.sendKudosWithEmoji(item, 'highfive'),
        },
        {
          text: 'Stellina',
          icon: 'star-outline',
          handler: () => this.sendKudosWithEmoji(item, 'star'),
        },
        { text: 'Annulla', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private sendKudosWithEmoji(item: FeedActivityItem, emoji: KudosEmoji): void {
    void this.haptics.tapLight();
    this.optimisticKudos.update((m) => new Map(m).set(item.activityId, true));
    this.pendingKudos.update((s) => new Set(s).add(item.activityId));

    this.http
      .post(`${environment.apiUrl}/social/kudos`, {
        toPlayerId: item.playerId,
        activityType: item.type,
        activityId: item.activityId,
        emoji,
      })
      .subscribe({
        next: () => {
          this.pendingKudos.update((s) => {
            const n = new Set(s);
            n.delete(item.activityId);
            return n;
          });
        },
        error: () => {
          this.optimisticKudos.update((m) => {
            const n = new Map(m);
            n.delete(item.activityId);
            return n;
          });
          this.pendingKudos.update((s) => {
            const n = new Set(s);
            n.delete(item.activityId);
            return n;
          });
        },
      });
  }

  // Rimozione amico via long press → action sheet
  protected async longPressFriend(friend: Friend): Promise<void> {
    void this.haptics.tapLight();
    const sheet = await this.actionSheet.create({
      buttons: [
        {
          text: 'Rimuovi amico',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => this.removeFriend(friend),
        },
        { text: 'Annulla', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private removeFriend(friend: Friend): void {
    void this.haptics.dismiss();

    this.http.delete(`${environment.apiUrl}/social/friends/${friend.friendshipId}`).subscribe({
      next: async () => {
        this.friends.update((list) => list.filter((f) => f.friendshipId !== friend.friendshipId));
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
  }

  // Accetta richiesta amicizia
  protected acceptRequest(req: FriendRequest): void {
    void this.haptics.success();

    this.http
      .post(`${environment.apiUrl}/social/friends/${req.friendshipId}/accept`, {})
      .subscribe({
        next: async () => {
          this.requests.update((list) => list.filter((r) => r.friendshipId !== req.friendshipId));
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

  // Rifiuta richiesta
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

  // Ricerca amici
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
    this.http
      .get<
        PlayerSearchResult[]
      >(`${environment.apiUrl}/players?username=${encodeURIComponent(username)}`)
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

  // Timestamp relativo in italiano
  protected relativeTime(isoTimestamp: string): string {
    const diff = Date.now() - new Date(isoTimestamp).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'adesso';
    if (minutes < 60) return `${minutes}min fa`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h fa`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ieri';
    return `${days}g fa`;
  }

  // Testo attività per card feed
  protected activityText(item: FeedActivityItem): string {
    if (item.type === 'quest_completion') {
      return `ha completato ${item.questName ?? 'una quest'}`;
    }
    return `ha sbloccato un collezionabile${item.collectibleRarity ? ' ' + item.collectibleRarity : ''}`;
  }

  protected avatarGradient(playerId: string): string {
    let seed = 0;
    for (let i = 0; i < playerId.length; i++) {
      seed = (seed * 31 + playerId.charCodeAt(i)) & 0xffffffff;
    }
    return AVATAR_GRADIENTS[Math.abs(seed) % AVATAR_GRADIENTS.length];
  }

  protected avatarInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  // Long press kudos — timer 500ms poi apre selettore
  private kudosLongPressTimer: ReturnType<typeof setTimeout> | null = null;

  protected longPressStart(event: PointerEvent, item: FeedActivityItem): void {
    this.kudosLongPressTimer = setTimeout(() => {
      void this.openKudosSelector(item);
    }, 500);
  }

  // Long press amico — timer 500ms poi action sheet
  private friendLongPressTimer: ReturnType<typeof setTimeout> | null = null;

  protected longPressStartFriend(event: PointerEvent, friend: Friend): void {
    this.friendLongPressTimer = setTimeout(() => {
      void this.longPressFriend(friend);
    }, 500);
  }

  protected longPressCancel(): void {
    if (this.kudosLongPressTimer) {
      clearTimeout(this.kudosLongPressTimer);
      this.kudosLongPressTimer = null;
    }
    if (this.friendLongPressTimer) {
      clearTimeout(this.friendLongPressTimer);
      this.friendLongPressTimer = null;
    }
  }
}
