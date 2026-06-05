import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular/standalone';
import type { GamificationResult } from '@trentino-quest/shared-types';

// 0=Dom 1=Lun ... 6=Sab
const DAY_LABELS_IT = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

interface DaySlot {
  label: string;
  filled: boolean;
  today: boolean;
  future: boolean;
}

const FIRE_PARTICLE_ANGLES = [0, 40, 80, 120, 160, 200, 240, 280, 320];
const FIRE_PARTICLE_TRAVELS = [70, 90, 60, 100, 75, 85, 65, 95, 80];

@Component({
  selector: 'app-streak-milestone-modal',
  templateUrl: './streak-milestone-modal.component.html',
  styleUrls: ['./streak-milestone-modal.component.scss'],
  standalone: true,
  imports: [IonContent],
})
export class StreakMilestoneModalComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);

  @Input() gamification!: GamificationResult;
  /** true quando aperto dalla home header come consultazione (non dopo un completamento) */
  @Input() viewOnly = false;

  protected readonly particleAngles = FIRE_PARTICLE_ANGLES;
  protected readonly particleTravels = FIRE_PARTICLE_TRAVELS;

  protected readonly days = signal<DaySlot[]>([]);

  protected get hasMultiplier(): boolean {
    return this.gamification.streakMultiplier > 1;
  }

  ngOnInit(): void {
    this.days.set(this.buildDaySlots());
  }

  private buildDaySlots(): DaySlot[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Lunedì della settimana corrente (Mon=0, ..., Sun=6 nella convenzione europea)
    const dowEu = (today.getDay() + 6) % 7; // 0=Lun, 6=Dom
    const monday = new Date(today);
    monday.setDate(today.getDate() - dowEu);

    const streak = this.gamification.currentStreak;

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday = d.getTime() === today.getTime();
      const isFuture = d.getTime() > today.getTime();
      const daysAgo = Math.round((today.getTime() - d.getTime()) / 86400000);
      return {
        label: DAY_LABELS_IT[d.getDay()],
        filled: !isFuture && daysAgo < streak,
        today: isToday,
        future: isFuture,
      };
    });
  }

  async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }
}
