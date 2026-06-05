import { Component, OnInit, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import type { DailyQuestItem } from '@trentino-quest/shared-types';
import { DailyQuestsService } from '../../../core/services/daily-quests/daily-quests.service';
import { HapticsService } from '../../../core/services/haptics/haptics.service';

/** Stato visuale di una missione giornaliera. */
type QuestStatus = 'pending' | 'claimable' | 'claimed';

/**
 * DailyQuestsPage — pannello delle 3 missioni giornaliere (GDD "Couch Loop").
 *
 * Il contesto (in_trentino/out_of_region) e' derivato dall'ultima posizione
 * GPS nota dentro DailyQuestsService.
 */
@Component({
  selector: 'app-daily-quests',
  templateUrl: './daily-quests.page.html',
  styleUrls: ['./daily-quests.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class DailyQuestsPage implements OnInit {
  private readonly service = inject(DailyQuestsService);
  private readonly haptics = inject(HapticsService);
  private readonly toastCtrl = inject(ToastController);
  private readonly location = inject(Location);

  protected readonly quests = this.service.quests;
  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  ngOnInit(): void {
    this.service.load();
  }

  protected goBack(): void {
    this.location.back();
  }

  protected statusOf(quest: DailyQuestItem): QuestStatus {
    if (!quest.completed) return 'pending';
    return quest.completedAt === null ? 'claimable' : 'claimed';
  }

  protected async claim(quest: DailyQuestItem): Promise<void> {
    if (this.statusOf(quest) !== 'claimable') return;
    this.haptics.success();
    this.service.claim(quest);
    await this.presentToast(`+${quest.xpReward} XP · +${quest.coinsReward} 🪙`);
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2200,
      position: 'bottom',
      cssClass: 'tq-toast',
    });
    await toast.present();
  }
}
