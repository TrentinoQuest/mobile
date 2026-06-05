import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import type { GamificationResult } from '@trentino-quest/shared-types';
import { Player, UserRole } from '@trentino-quest/shared-types';
import { QuestService } from '../../../../core/services/quest/quest.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { StreakMilestoneModalComponent } from '../streak-milestone-modal/streak-milestone-modal.component';

const XP_LEVELS = [0, 200, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000];

// Circonferenza cerchio XP ring (r=17, viewBox 44x44)
const XP_RING_CIRCUMFERENCE = 2 * Math.PI * 17;

@Component({
  selector: 'app-home-header',
  templateUrl: './home-header.component.html',
  styleUrls: ['./home-header.component.scss'],
  standalone: true,
  imports: [],
})
export class HomeHeaderComponent {
  private readonly questService = inject(QuestService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);

  protected readonly discovered = this.questService.discoveredCount;
  protected readonly total = this.questService.totalCount;
  protected readonly loading = this.questService.loading;

  protected readonly ringCircumference = XP_RING_CIRCUMFERENCE;

  private readonly player = computed<Player | null>(() => {
    const user = this.authService.currentUser();
    if (user?.role === UserRole.PLAYER) return user as Player;
    return null;
  });

  protected readonly username = computed<string>(() => this.player()?.username ?? '');
  protected readonly level = computed<number>(() => this.player()?.level ?? 1);
  protected readonly levelTitle = computed<string>(() => this.player()?.levelTitle ?? 'Visitatore');
  protected readonly xp = computed<number>(() => this.player()?.xp ?? 0);
  protected readonly currentStreak = computed<number>(() => this.player()?.currentStreak ?? 0);
  protected readonly coins = computed<number>(() => this.player()?.coins ?? 0);
  protected readonly streakShieldActive = computed<boolean>(
    () => this.player()?.streakShieldActive ?? false,
  );

  private readonly xpProgress = computed<number>(() => {
    const lvl = this.level();
    if (lvl >= XP_LEVELS.length) return 100;
    const start = XP_LEVELS[lvl - 1];
    const end = XP_LEVELS[lvl];
    if (end === start) return 100;
    return Math.min(100, Math.max(0, Math.round(((this.xp() - start) / (end - start)) * 100)));
  });

  protected readonly xpRingOffset = computed<number>(
    () => XP_RING_CIRCUMFERENCE * (1 - this.xpProgress() / 100),
  );

  openProfile(): void {
    void this.router.navigate(['/giocatore/profilo']);
  }

  async openStreakDetail(): Promise<void> {
    if (this.currentStreak() === 0) return;
    const p = this.player();
    if (!p) return;

    const gamification: GamificationResult = {
      xpAwarded: 0,
      coinsAwarded: 0,
      streakMultiplier: 1,
      currentStreak: p.currentStreak ?? 0,
      longestStreak: p.longestStreak ?? p.currentStreak ?? 0,
      newLevel: null,
      levelTitle: p.levelTitle ?? '',
      totalXp: p.xp ?? 0,
      shieldEarned: false,
      shieldConsumed: false,
      streakBroken: false,
    };

    const modal = await this.modalCtrl.create({
      component: StreakMilestoneModalComponent,
      cssClass: 'tq-scan-modal',
      backdropDismiss: true,
      componentProps: { gamification, viewOnly: true },
    });
    await modal.present();
  }
}
