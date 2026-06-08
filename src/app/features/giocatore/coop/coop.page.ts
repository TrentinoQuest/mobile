import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  alarmOutline,
  arrowBackOutline,
  checkmarkCircle,
  checkmarkDoneOutline,
  closeOutline,
  peopleOutline,
  starOutline,
  timeOutline,
  trophyOutline,
  walkOutline,
} from 'ionicons/icons';
import { Player, UserRole } from '@trentino-quest/shared-types';
import { AuthService } from '../../../core/services/auth/auth.service';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { environment } from '../../../../environments/environment';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface CoopChallengeView {
  id: string;
  initiatorId: string;
  partnerId: string;
  type: 'walk_50km' | 'complete_10_quests' | 'unlock_5_rare';
  title: string;
  description: string;
  targetValue: number;
  initiatorProgress: number;
  partnerProgress: number;
  totalPercentage: number;
  status: 'active' | 'completed' | 'expired';
  startedAt: string;
  expiresAt: string;
  rewardCollectibleId: string | null;
}

interface Friend {
  friendshipId: string;
  playerId: string;
  username: string;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const CHALLENGE_INFO: Record<
  CoopChallengeView['type'],
  { icon: string; label: string; desc: string }
> = {
  walk_50km: {
    icon: 'walk-outline',
    label: 'Cammina 50 km',
    desc: 'Accumulate 50 km camminando sul territorio',
  },
  complete_10_quests: {
    icon: 'checkmark-done-outline',
    label: 'Completa 10 quest',
    desc: 'Completate insieme 10 quest nel Trentino',
  },
  unlock_5_rare: {
    icon: 'star-outline',
    label: '5 collezionabili rari',
    desc: 'Sbloccate 5 collezionabili rari o superiori',
  },
};

const CHALLENGE_TYPES: CoopChallengeView['type'][] = [
  'walk_50km',
  'complete_10_quests',
  'unlock_5_rare',
];

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#5A8A3A,#2F4A1F)',
  'linear-gradient(135deg,#8E6314,#4A3416)',
  'linear-gradient(135deg,#3A7A9A,#1F3A4A)',
  'linear-gradient(135deg,#7A3A9A,#3A1F4A)',
  'linear-gradient(135deg,#9A3A3A,#4A1F1F)',
  'linear-gradient(135deg,#3A9A8A,#1F4A3A)',
];

const MS_48H = 48 * 60 * 60 * 1000;
const MS_24H = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-coop',
  templateUrl: './coop.page.html',
  styleUrls: ['./coop.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, IonSpinner, TqButtonComponent],
})
export class CoopPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);
  private readonly toastCtrl = inject(ToastController);

  protected readonly CHALLENGE_INFO = CHALLENGE_INFO;
  protected readonly CHALLENGE_TYPES = CHALLENGE_TYPES;

  protected readonly myId = computed<string>(() => {
    const user = this.auth.currentUser();
    return user?.role === UserRole.PLAYER ? (user as Player).id : '';
  });

  protected readonly loading = signal(true);
  protected readonly challenges = signal<CoopChallengeView[]>([]);
  protected readonly friends = signal<Friend[]>([]);
  private readonly friendMap = signal<Map<string, string>>(new Map());

  // ── Crea sfida ────────────────────────────────────────────────────────────
  protected readonly showCreateSheet = signal(false);
  protected readonly selectedType = signal<CoopChallengeView['type'] | null>(null);
  protected readonly selectedPartnerId = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly canCreate = computed(
    () => this.selectedType() !== null && this.selectedPartnerId() !== null && !this.creating(),
  );

  constructor() {
    addIcons({
      arrowBackOutline,
      addOutline,
      walkOutline,
      checkmarkDoneOutline,
      starOutline,
      alarmOutline,
      trophyOutline,
      checkmarkCircle,
      closeOutline,
      peopleOutline,
      timeOutline,
    });
  }

  ngOnInit(): void {
    // Se arrivato dalla sezione amici con un partner pre-selezionato, apri subito lo sheet
    const state = history.state as { partnerId?: string };
    if (state?.partnerId) {
      this.selectedPartnerId.set(state.partnerId);
      this.showCreateSheet.set(true);
    }
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    let challengesDone = false;
    let friendsDone = false;
    let loadedChallenges: CoopChallengeView[] = [];

    this.http.get<CoopChallengeView[]>(`${environment.apiUrl}/coop/challenges`).subscribe({
      next: (data) => {
        this.challenges.set(data);
        loadedChallenges = data;
        challengesDone = true;
        if (friendsDone) this.finishLoad(loadedChallenges);
      },
      error: () => {
        challengesDone = true;
        if (friendsDone) this.loading.set(false);
      },
    });

    this.http.get<Friend[]>(`${environment.apiUrl}/social/friends`).subscribe({
      next: (data) => {
        this.friends.set(data);
        this.friendMap.set(new Map(data.map((f) => [f.playerId, f.username])));
        friendsDone = true;
        if (challengesDone) this.finishLoad(loadedChallenges);
      },
      error: () => {
        friendsDone = true;
        if (challengesDone) this.loading.set(false);
      },
    });
  }

  private finishLoad(challenges: CoopChallengeView[]): void {
    this.loading.set(false);
    const unseen = challenges.find((c) => c.status === 'completed' && !this.celebrateSeen(c.id));
    if (unseen) {
      void this.haptics.collectibleUnlock();
      this.audio.playCollectible();
      this.markCelebrateSeen(unseen.id);
    }
  }

  // ── Helper avatar ─────────────────────────────────────────────────────────

  protected avatarGradient(id: string): string {
    let seed = 0;
    for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) & 0xffffffff;
    return AVATAR_GRADIENTS[Math.abs(seed) % AVATAR_GRADIENTS.length];
  }

  protected avatarInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  // ── Helper sfide ──────────────────────────────────────────────────────────

  protected getPartnerId(c: CoopChallengeView): string {
    return c.initiatorId === this.myId() ? c.partnerId : c.initiatorId;
  }

  protected partnerUsername(c: CoopChallengeView): string {
    return this.friendMap().get(this.getPartnerId(c)) ?? 'Esploratore';
  }

  protected myPercent(c: CoopChallengeView): number {
    const mine = c.initiatorId === this.myId() ? c.initiatorProgress : c.partnerProgress;
    return Math.min(100, Math.round((mine / c.targetValue) * 100));
  }

  protected partnerPercent(c: CoopChallengeView): number {
    const theirs = c.initiatorId === this.myId() ? c.partnerProgress : c.initiatorProgress;
    return Math.min(100 - this.myPercent(c), Math.round((theirs / c.targetValue) * 100));
  }

  protected isPartnerInactive(c: CoopChallengeView): boolean {
    return Date.now() - new Date(c.startedAt).getTime() > MS_48H;
  }

  protected expiresLabel(c: CoopChallengeView): string {
    const diff = new Date(c.expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Scaduta';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}g`;
    return `${Math.floor(diff / (1000 * 60 * 60))}h`;
  }

  // ── Nudge ─────────────────────────────────────────────────────────────────

  protected canNudge(partnerId: string): boolean {
    const last = localStorage.getItem(`nudge_last_${partnerId}`);
    if (!last) return true;
    return Date.now() - parseInt(last) > MS_24H;
  }

  protected async sendNudge(c: CoopChallengeView): Promise<void> {
    const pid = this.getPartnerId(c);
    if (!this.canNudge(pid)) return;

    void this.haptics.warning();
    localStorage.setItem(`nudge_last_${pid}`, String(Date.now()));

    this.http.post(`${environment.apiUrl}/coop/nudge/${pid}`, {}).subscribe({
      next: async () => {
        const toast = await this.toastCtrl.create({
          message: 'Sveglia inviata!',
          duration: 2500,
          position: 'bottom',
        });
        await toast.present();
      },
      error: () => {
        localStorage.removeItem(`nudge_last_${pid}`);
      },
    });
  }

  // ── Crea sfida ────────────────────────────────────────────────────────────

  protected openCreateSheet(): void {
    void this.haptics.tapMedium();
    this.selectedType.set(null);
    this.selectedPartnerId.set(null);
    this.showCreateSheet.set(true);
  }

  protected closeCreateSheet(): void {
    void this.haptics.tapLight();
    this.showCreateSheet.set(false);
  }

  protected selectType(type: CoopChallengeView['type']): void {
    void this.haptics.tapLight();
    this.selectedType.set(type);
  }

  protected selectPartner(playerId: string): void {
    void this.haptics.tapLight();
    this.selectedPartnerId.set(this.selectedPartnerId() === playerId ? null : playerId);
  }

  protected async createChallenge(): Promise<void> {
    if (!this.canCreate()) return;
    void this.haptics.tapHeavy();
    this.audio.playTap();
    this.creating.set(true);

    this.http
      .post<CoopChallengeView>(`${environment.apiUrl}/coop/challenges`, {
        partnerId: this.selectedPartnerId(),
        type: this.selectedType(),
      })
      .subscribe({
        next: async (newChallenge) => {
          this.challenges.update((list) => [newChallenge, ...list]);
          this.creating.set(false);
          this.showCreateSheet.set(false);
          const toast = await this.toastCtrl.create({
            message: 'Sfida lanciata! Il tuo amico riceverà una notifica.',
            duration: 3500,
            position: 'bottom',
          });
          await toast.present();
        },
        error: async () => {
          this.creating.set(false);
          void this.haptics.error();
          const toast = await this.toastCtrl.create({
            message: 'Impossibile creare la sfida. Riprova.',
            duration: 3000,
            position: 'bottom',
            color: 'danger',
          });
          await toast.present();
        },
      });
  }

  // ── Navigazione ───────────────────────────────────────────────────────────

  protected goBack(): void {
    void this.router.navigate(['/giocatore/profilo']);
  }

  // ── Celebrate ─────────────────────────────────────────────────────────────

  private celebrateSeen(id: string): boolean {
    return localStorage.getItem(`coop_seen_${id}`) === 'true';
  }

  private markCelebrateSeen(id: string): void {
    localStorage.setItem(`coop_seen_${id}`, 'true');
  }
}
