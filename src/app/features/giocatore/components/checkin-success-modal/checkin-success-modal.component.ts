import { Component, Input, inject } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular/standalone';
import type { GamificationResult } from '@trentino-quest/shared-types';
import { StreakMilestoneModalComponent } from '../streak-milestone-modal/streak-milestone-modal.component';
import { LevelUpModalComponent } from '../level-up-modal/level-up-modal.component';

@Component({
  selector: 'app-checkin-success-modal',
  templateUrl: './checkin-success-modal.component.html',
  styleUrls: ['./checkin-success-modal.component.scss'],
  standalone: true,
  imports: [IonContent],
})
export class CheckinSuccessModalComponent {
  private readonly modalCtrl = inject(ModalController);

  @Input() questName = '';
  @Input() pointsAwarded = 0;
  @Input() newTotalPoints = 0;
  @Input() gamification: GamificationResult | null = null;

  protected get hasStreakMultiplier(): boolean {
    return (this.gamification?.streakMultiplier ?? 1) > 1;
  }

  protected get leveledUp(): boolean {
    return this.gamification?.newLevel !== null && this.gamification?.newLevel !== undefined;
  }

  async dismiss(): Promise<void> {
    const gamification = this.gamification;
    const showLevelUp = gamification?.newLevel != null;
    const showStreak =
      gamification != null && gamification.currentStreak > 0 && !gamification.streakBroken;

    await this.modalCtrl.dismiss();

    if (showLevelUp) {
      const levelUpModal = await this.modalCtrl.create({
        component: LevelUpModalComponent,
        cssClass: 'tq-scan-modal',
        backdropDismiss: true,
        componentProps: { gamification },
      });
      await levelUpModal.present();
      await levelUpModal.onDidDismiss();
    }

    if (showStreak) {
      const streakModal = await this.modalCtrl.create({
        component: StreakMilestoneModalComponent,
        cssClass: 'tq-scan-modal',
        backdropDismiss: true,
        componentProps: { gamification },
      });
      await streakModal.present();
    }
  }
}
