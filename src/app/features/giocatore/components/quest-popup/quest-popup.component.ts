import { Component, Input, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import {
  AnyQuest,
  CheckInResponse,
  PlayerQuestStatus,
  QuestType,
  SecondaryQuest,
} from '../../../../core/services/quest/quest.types';
import { QuestService } from '../../../../core/services/quest/quest.service';
import { GeolocationService } from '../../../../core/services/geolocation/geolocation.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { PlayerProfileService } from '../../../../core/services/player-profile/player-profile.service';
import { haversineMeters } from '../../../../core/utils/geo';
import { formatCheckInError } from '../../../../core/utils/check-in-errors';
import { CheckinSuccessModalComponent } from '../checkin-success-modal/checkin-success-modal.component';
import { ScanModalComponent } from '../scan-modal/scan-modal.component';

type CheckInState = 'idle' | 'loading' | 'error';

@Component({
  selector: 'app-quest-popup',
  templateUrl: './quest-popup.component.html',
  styleUrls: ['./quest-popup.component.scss'],
  standalone: true,
})
export class QuestPopupComponent {
  private readonly questService = inject(QuestService);
  private readonly geoService = inject(GeolocationService);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(PlayerProfileService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);

  protected readonly quest = signal<AnyQuest | null>(null);
  protected readonly playerStatus = signal<PlayerQuestStatus>('available');
  protected readonly checkInState = signal<CheckInState>('idle');
  protected readonly checkInError = signal('');

  protected readonly QuestType = QuestType;

  protected readonly statusLabel = computed<string>(
    () => PLAYER_STATUS_LABELS[this.playerStatus()],
  );
  protected readonly statusModifier = computed<string>(
    () => `quest-popup__kicker--${this.playerStatus()}`,
  );

  protected readonly typeLabel = computed<string>(() => {
    const q = this.quest();
    if (!q) return '';
    return q.type === QuestType.PRIMARY ? 'Quest principale · QR' : 'Quest secondaria · Check-in';
  });

  /** Distanza in metri tra posizione utente e quest secondaria. */
  protected readonly distanceMeters = computed<number | null>(() => {
    const q = this.quest();
    if (!q || q.type !== QuestType.SECONDARY) return null;
    const pos = this.geoService.position();
    if (!pos) return null;
    const sec = q as SecondaryQuest;
    return haversineMeters(pos.lat, pos.lng, sec.position.lat, sec.position.lng);
  });

  /** True se l'utente è entro il raggio di check-in. */
  protected readonly isInRange = computed<boolean>(() => {
    const q = this.quest();
    if (!q || q.type !== QuestType.SECONDARY) return false;
    const dist = this.distanceMeters();
    if (dist === null) return false;
    return dist <= (q as SecondaryQuest).checkInRadiusMeters;
  });

  /** Etichetta distanza formattata per il template. */
  protected readonly distanceLabel = computed<string>(() => {
    const dist = this.distanceMeters();
    if (dist === null) return 'GPS non disponibile';
    if (dist < 1000) return `${Math.round(dist)} m`;
    return `${(dist / 1000).toFixed(1)} km`;
  });

  @Input() set questData(value: AnyQuest | null) {
    this.quest.set(value);
  }

  @Input() set status(value: PlayerQuestStatus) {
    this.playerStatus.set(value);
  }

  checkIn(): void {
    const q = this.quest();
    if (!q || q.type !== QuestType.SECONDARY) return;

    const pos = this.geoService.position();
    if (!pos) {
      this.checkInError.set(
        'Posizione GPS non disponibile. Verifica che la localizzazione sia attiva.',
      );
      this.checkInState.set('error');
      return;
    }

    this.checkInState.set('loading');

    // Nessun takeUntilDestroyed: la request HTTP deve completarsi anche se il
    // popup viene chiuso nel frattempo (l'Observable completa da solo dopo una
    // sola emissione, quindi non c'è memory leak).
    this.questService.checkIn(q.id, { position: { lat: pos.lat, lng: pos.lng } }).subscribe({
      next: (response: CheckInResponse) => {
        // Aggiorna XP/streak/livello in auth (profilo) e invalida cache progressi
        this.authService.updateAfterCompletion(response.totalPoints, response.gamification);
        this.profileService.reset();
        // Apri il modal visivo — avviene prima che il re-render della mappa
        // distrugga il popup, così l'utente vede il feedback
        void this.openSuccessModal(q.name, response);
      },
      error: (err: unknown) => {
        this.checkInError.set(formatCheckInError(err));
        this.checkInState.set('error');
      },
    });
  }

  retryCheckIn(): void {
    this.checkInState.set('idle');
    this.checkInError.set('');
  }

  /** Apre la pagina di dettaglio completa della quest. */
  async openDetail(): Promise<void> {
    const q = this.quest();
    if (!q) return;
    await this.router.navigate(['/giocatore/quest', q.id]);
  }

  async openScanModal(): Promise<void> {
    const q = this.quest();
    if (!q) return;
    const modal = await this.modalCtrl.create({
      component: ScanModalComponent,
      cssClass: 'tq-scan-modal',
      backdropDismiss: false,
      componentProps: { questId: q.id },
    });
    await modal.present();
  }

  private async openSuccessModal(questName: string, response: CheckInResponse): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: CheckinSuccessModalComponent,
      cssClass: 'tq-scan-modal',
      backdropDismiss: true,
      componentProps: {
        questName,
        pointsAwarded: response.pointsAwarded,
        newTotalPoints: response.totalPoints,
        gamification: response.gamification,
      },
    });
    await modal.present();
  }
}

// ----------------------------------------------------------------
// Utility private al modulo
// ----------------------------------------------------------------

const PLAYER_STATUS_LABELS: Record<PlayerQuestStatus, string> = {
  discovered: '— SCOPERTA —',
  available: '— DA SCOPRIRE —',
  locked: '— BLOCCATA —',
};
