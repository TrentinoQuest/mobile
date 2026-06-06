import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonContent, IonIcon, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  walkOutline,
  searchOutline,
  trendingUpOutline,
  helpCircleOutline,
  albumsOutline,
  heartOutline,
  checkmarkCircle,
  closeCircle,
  mapOutline,
  bookmarkOutline,
} from 'ionicons/icons';
import {
  CollectibleRarity,
  DailyQuestContext,
  DailyQuestType,
  PrimaryQuest,
  QuestType,
} from '@trentino-quest/shared-types';
import type {
  CollectibleEntry,
  CompleteDailyQuestResponse,
  DailyQuestAssignmentView,
  DailyQuestItem,
  LoreAnswerResponse,
  LoreQuestionView,
} from '@trentino-quest/shared-types';
import { PlayerProfileService } from '../../../core/services/player-profile/player-profile.service';
import { QuestService } from '../../../core/services/quest/quest.service';
import { GeolocationService } from '../../../core/services/geolocation/geolocation.service';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';
import { CollectibleDetailModalComponent } from '../components/collectible-detail-modal/collectible-detail-modal.component';
import {
  TqBadgeComponent,
  BadgeColor,
} from '../../../shared/components/tq-badge/tq-badge.component';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { TqCardComponent } from '../../../shared/components/tq-card/tq-card.component';
import { environment } from '../../../../environments/environment';

type TaccuinoSection = 'collezione' | 'quiz' | 'missioni';

interface AlbumCard {
  id: string;
  name: string;
  locked: boolean;
  paletteSeed: number;
  imageUrl: string;
  rarity: CollectibleRarity | null;
  questName: string;
  entry: CollectibleEntry | null;
}

const PALETTES = [
  { sky: '#3B2E1E', mid: '#5A4A28', fg: '#C8930F' },
  { sky: '#1F2D2A', mid: '#2E4A34', fg: '#6BA046' },
  { sky: '#2A2118', mid: '#4A3924', fg: '#8E6314' },
  { sky: '#1B2530', mid: '#2C3D4E', fg: '#7B92A0' },
  { sky: '#3A2A1F', mid: '#5C4128', fg: '#D4A23A' },
  { sky: '#1A2924', mid: '#2C4035', fg: '#5A8A3A' },
];

const MISSION_ICONS: Record<DailyQuestType, string> = {
  [DailyQuestType.WALK_2KM]: 'walk-outline',
  [DailyQuestType.FIND_SECONDARY]: 'search-outline',
  [DailyQuestType.REACH_ALTITUDE]: 'trending-up-outline',
  [DailyQuestType.LORE_QUIZ]: 'help-circle-outline',
  [DailyQuestType.FLIP_COLLECTIBLES]: 'albums-outline',
  [DailyQuestType.SEND_KUDOS]: 'heart-outline',
};

@Component({
  selector: 'app-album',
  templateUrl: './album.page.html',
  styleUrls: ['./album.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, NgClass, TqBadgeComponent, TqButtonComponent, TqCardComponent],
})
export class AlbumPage implements OnInit, OnDestroy {
  private readonly profileService = inject(PlayerProfileService);
  private readonly questService = inject(QuestService);
  private readonly geoService = inject(GeolocationService);
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);
  private readonly modalCtrl = inject(ModalController);
  private readonly http = inject(HttpClient);

  protected readonly CollectibleRarity = CollectibleRarity;
  protected readonly DailyQuestType = DailyQuestType;
  protected readonly MISSION_ICONS = MISSION_ICONS;

  // ── Sezione attiva ──────────────────────────────────────────────────────────
  protected readonly activeSection = signal<TaccuinoSection>('collezione');

  // ── Collezione ──────────────────────────────────────────────────────────────
  protected readonly loading = this.profileService.loading;
  protected readonly error = this.profileService.error;
  protected readonly unlockedCount = this.profileService.unlockedCount;

  protected readonly collectibleTotal = computed(
    () =>
      this.questService
        .quests()
        .filter((q): q is PrimaryQuest => q.type === QuestType.PRIMARY && q.collectibleId !== null)
        .length,
  );

  protected readonly progressPercent = computed(() => {
    const total = this.collectibleTotal();
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.unlockedCount() / total) * 100));
  });

  protected readonly CIRCUMFERENCE = 2 * Math.PI * 38;

  protected readonly strokeDashoffset = computed(
    () => this.CIRCUMFERENCE * (1 - this.progressPercent() / 100),
  );

  protected readonly displayedCards = computed<AlbumCard[]>(() => {
    const col = this.profileService.collection();
    const total = this.collectibleTotal();
    const quests = this.questService.quests();

    const questNameFor = (collectibleId: string): string =>
      (
        quests.find(
          (q): q is PrimaryQuest =>
            q.type === QuestType.PRIMARY && q.collectibleId === collectibleId,
        ) as PrimaryQuest | undefined
      )?.name ?? '';

    const unlocked: AlbumCard[] = col.map((entry, i) => ({
      id: entry.collectible.id,
      name: entry.collectible.name,
      locked: false,
      paletteSeed: i,
      imageUrl: entry.collectible.imageUrl ?? '',
      rarity: entry.collectible.rarity,
      questName: questNameFor(entry.collectible.id),
      entry,
    }));

    const lockedCount = Math.max(0, total - col.length);
    const locked: AlbumCard[] = Array.from({ length: lockedCount }, (_, i) => ({
      id: `locked-${i}`,
      name: '',
      locked: true,
      paletteSeed: col.length + i,
      imageUrl: '',
      rarity: null,
      questName: '',
      entry: null,
    }));

    return [...unlocked, ...locked];
  });

  // ── Quiz del Giorno ─────────────────────────────────────────────────────────
  protected readonly quizLoading = signal(false);
  protected readonly quizQuestion = signal<LoreQuestionView | null>(null);
  protected readonly quizSelectedIndex = signal<number | null>(null);
  protected readonly quizResult = signal<LoreAnswerResponse | null>(null);
  protected readonly quizAnswering = signal(false);
  protected readonly quizCountdown = signal('');
  protected readonly quizError = signal('');
  private quizCountdownInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly quizAnswered = computed(
    () => this.quizQuestion()?.alreadyAnswered === true || this.quizResult() !== null,
  );

  // ── Locked sheet ────────────────────────────────────────────────────────────
  protected readonly lockedSheetVisible = signal(false);

  // ── Quiz reward animation ────────────────────────────────────────────────────
  protected readonly quizRewardVisible = signal(false);
  protected readonly quizRewardAmount = signal(0);

  // ── Missioni ────────────────────────────────────────────────────────────────
  protected readonly missionsLoading = signal(false);
  protected readonly missions = signal<DailyQuestItem[]>([]);
  protected readonly missionsCompleting = signal<Set<string>>(new Set());
  // Missioni per cui il reward è già stato riscosso in questa sessione
  protected readonly claimedMissions = signal<Set<string>>(new Set());
  protected readonly missionRewardAnimating = signal<Set<string>>(new Set());
  protected readonly missionsCountdown = signal('');
  private missionsCountdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    addIcons({
      walkOutline,
      searchOutline,
      trendingUpOutline,
      helpCircleOutline,
      albumsOutline,
      heartOutline,
      checkmarkCircle,
      closeCircle,
      mapOutline,
      bookmarkOutline,
    });
  }

  ngOnInit(): void {
    this.profileService.loadCollection();
    this.profileService.loadProgress();
  }

  ngOnDestroy(): void {
    this.clearQuizCountdown();
    this.clearMissionsCountdown();
  }

  // ── Navigazione sezioni ─────────────────────────────────────────────────────

  protected setSection(section: TaccuinoSection): void {
    if (this.activeSection() === section) return;
    void this.haptics.tapLight();
    this.activeSection.set(section);

    if (section === 'quiz' && !this.quizQuestion()) {
      this.loadQuiz();
    }
    if (section === 'missioni' && this.missions().length === 0) {
      this.loadMissions();
    }
  }

  // ── Collezione ──────────────────────────────────────────────────────────────

  protected palette(seed: number) {
    return PALETTES[seed % PALETTES.length];
  }

  protected rarityColor(rarity: CollectibleRarity | null): BadgeColor {
    switch (rarity) {
      case CollectibleRarity.COMMON:
        return 'common';
      case CollectibleRarity.UNCOMMON:
        return 'rare';
      case CollectibleRarity.RARE:
        return 'rare';
      case CollectibleRarity.LEGENDARY:
        return 'legendary';
      default:
        return 'primary';
    }
  }

  protected openLockedSheet(): void {
    void this.haptics.tapLight();
    this.lockedSheetVisible.set(true);
  }

  protected closeLockedSheet(): void {
    this.lockedSheetVisible.set(false);
  }

  protected async openDetail(card: AlbumCard): Promise<void> {
    if (card.locked || !card.entry) {
      this.openLockedSheet();
      return;
    }
    void this.haptics.tapMedium();
    const modal = await this.modalCtrl.create({
      component: CollectibleDetailModalComponent,
      cssClass: 'tq-collectible-detail-modal',
      backdropDismiss: true,
      componentProps: {
        entry: card.entry,
        questName: card.questName,
        paletteSeed: card.paletteSeed,
      },
    });
    await modal.present();
  }

  // ── Quiz del Giorno ─────────────────────────────────────────────────────────

  private loadQuiz(): void {
    this.quizLoading.set(true);
    this.http.get<LoreQuestionView>(`${environment.apiUrl}/lore/daily-question`).subscribe({
      next: (q) => {
        this.quizQuestion.set(q);
        this.quizLoading.set(false);
        if (q.alreadyAnswered) {
          this.startQuizCountdown();
        }
      },
      error: () => this.quizLoading.set(false),
    });
  }

  protected async answerQuiz(index: number): Promise<void> {
    if (this.quizAnswering() || this.quizAnswered()) return;
    const question = this.quizQuestion();
    if (!question) return;

    this.quizSelectedIndex.set(index);
    this.quizAnswering.set(true);
    void this.haptics.tapMedium();
    this.audio.playTap();

    this.http
      .post<LoreAnswerResponse>(`${environment.apiUrl}/lore/answer`, {
        optionIndex: index,
      })
      .subscribe({
        next: (res) => {
          this.quizResult.set(res);
          this.quizAnswering.set(false);
          if (res.correct) {
            void this.haptics.success();
            this.audio.playSuccess();
            this.triggerQuizReward(res.coinsAwarded);
          } else {
            void this.haptics.error();
            this.audio.playError();
          }
          this.startQuizCountdown();
        },
        error: () => {
          this.quizAnswering.set(false);
          this.quizSelectedIndex.set(null);
          this.quizError.set('Impossibile inviare la risposta. Riprova.');
          setTimeout(() => this.quizError.set(''), 3000);
        },
      });
  }

  protected saveMapFragment(hint: string): void {
    const saved = JSON.parse(localStorage.getItem('tq_map_fragments') ?? '[]') as string[];
    if (!saved.includes(hint)) {
      saved.push(hint);
      localStorage.setItem('tq_map_fragments', JSON.stringify(saved));
    }
    void this.haptics.tapLight();
  }

  private startQuizCountdown(): void {
    this.clearQuizCountdown();
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      this.quizCountdown.set(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    tick();
    this.quizCountdownInterval = setInterval(tick, 1000);
  }

  private clearQuizCountdown(): void {
    if (this.quizCountdownInterval !== null) {
      clearInterval(this.quizCountdownInterval);
      this.quizCountdownInterval = null;
    }
  }

  // ── Missioni ────────────────────────────────────────────────────────────────

  private loadMissions(): void {
    this.missionsLoading.set(true);
    const pos = this.geoService.position();
    const inTrentino =
      pos !== null && pos.lat >= 45.6 && pos.lat <= 46.6 && pos.lng >= 10.4 && pos.lng <= 12.0;
    const context = inTrentino ? DailyQuestContext.IN_TRENTINO : DailyQuestContext.OUT_OF_REGION;

    this.http
      .get<DailyQuestAssignmentView>(`${environment.apiUrl}/player/daily-quests`, {
        params: { context },
      })
      .subscribe({
        next: (res) => {
          this.missions.set(res.quests);
          this.missionsLoading.set(false);
          this.startMissionsCountdown();
        },
        error: () => this.missionsLoading.set(false),
      });
  }

  protected async claimMission(type: DailyQuestType): Promise<void> {
    const completing = new Set(this.missionsCompleting());
    if (completing.has(type)) return;
    completing.add(type);
    this.missionsCompleting.set(completing);

    this.http
      .post<CompleteDailyQuestResponse>(
        `${environment.apiUrl}/player/daily-quests/${type}/complete`,
        {},
      )
      .subscribe({
        next: (res) => {
          void this.haptics.success();
          this.audio.playSuccess();
          this.triggerMissionReward(type);
          // Segna come riscosso localmente
          const claimed = new Set(this.claimedMissions());
          claimed.add(type);
          this.claimedMissions.set(claimed);
          const done = new Set(this.missionsCompleting());
          done.delete(type);
          this.missionsCompleting.set(done);
        },
        error: () => {
          const done = new Set(this.missionsCompleting());
          done.delete(type);
          this.missionsCompleting.set(done);
        },
      });
  }

  private triggerQuizReward(amount: number): void {
    this.quizRewardAmount.set(amount);
    this.quizRewardVisible.set(true);
    setTimeout(() => this.quizRewardVisible.set(false), 800);
  }

  private triggerMissionReward(type: string): void {
    const animating = new Set(this.missionRewardAnimating());
    animating.add(type);
    this.missionRewardAnimating.set(animating);
    setTimeout(() => {
      const current = new Set(this.missionRewardAnimating());
      current.delete(type);
      this.missionRewardAnimating.set(current);
    }, 800);
  }

  private startMissionsCountdown(): void {
    this.clearMissionsCountdown();
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      this.missionsCountdown.set(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    tick();
    this.missionsCountdownInterval = setInterval(tick, 1000);
  }

  private clearMissionsCountdown(): void {
    if (this.missionsCountdownInterval !== null) {
      clearInterval(this.missionsCountdownInterval);
      this.missionsCountdownInterval = null;
    }
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  protected missionBorderClass(m: DailyQuestItem): string {
    if (m.completed) return 'mission-card--completed';
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    if (now > midnight) return 'mission-card--expired';
    return '';
  }
}
