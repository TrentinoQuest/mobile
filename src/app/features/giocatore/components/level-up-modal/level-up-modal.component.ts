import { Component, Input, inject } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular/standalone';
import type { GamificationResult } from '@trentino-quest/shared-types';

const STAR_ANGLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
const STAR_TRAVELS = [90, 115, 75, 130, 85, 100, 95, 120, 80, 105];

@Component({
  selector: 'app-level-up-modal',
  templateUrl: './level-up-modal.component.html',
  styleUrls: ['./level-up-modal.component.scss'],
  standalone: true,
  imports: [IonContent],
})
export class LevelUpModalComponent {
  private readonly modalCtrl = inject(ModalController);

  @Input() gamification!: GamificationResult;

  protected readonly starAngles = STAR_ANGLES;
  protected readonly starTravels = STAR_TRAVELS;

  protected get newLevel(): number {
    return this.gamification.newLevel ?? 1;
  }

  protected get levelTitle(): string {
    return this.gamification.levelTitle ?? '';
  }

  protected get xpAwarded(): number {
    return this.gamification.xpAwarded;
  }

  async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }
}
