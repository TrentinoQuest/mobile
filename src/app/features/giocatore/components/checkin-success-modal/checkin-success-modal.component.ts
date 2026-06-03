import { Component, Input, inject } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular/standalone';

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

  async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }
}
