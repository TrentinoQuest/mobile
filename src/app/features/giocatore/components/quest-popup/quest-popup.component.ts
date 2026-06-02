import { Component, Input, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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

  protected readonly quest = signal<AnyQuest | null>(null);
  protected readonly playerStatus = signal<PlayerQuestStatus>('available');
  protected readonly checkInState = signal<CheckInState>('idle');
  protected readonly checkInError = signal('');

  protected readonly QuestType = QuestType;

  protected readonly statusLabel = computed<string>(() => PLAYER_STATUS_LABELS[this.playerStatus()]);
  protected readonly statusModifier = computed<string>(() => `quest-popup__kicker--${this.playerStatus()}`);

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
      this.checkInError.set('Posizione GPS non disponibile. Verifica che la localizzazione sia attiva.');
      this.checkInState.set('error');
      return;
    }

    this.checkInState.set('loading');

    // Nessun takeUntilDestroyed: la request HTTP deve completarsi anche se il
    // popup viene chiuso nel frattempo (l'Observable completa da solo dopo una
    // sola emissione, quindi non c'è memory leak).
    this.questService
      .checkIn(q.id, { position: { lat: pos.lat, lng: pos.lng } })
      .subscribe({
        next: (response: CheckInResponse) => {
          // Aggiorna punti in auth (profilo) e invalida cache progressi
          this.authService.updateTotalPoints(response.totalPoints);
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

  async openScanModal(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ScanModalComponent,
      cssClass: 'tq-scan-modal',
      backdropDismiss: false,
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

/** Formula Haversine: distanza in metri tra due coordinate WGS84. */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CHECK_IN_ERROR_MESSAGES: Record<string, string> = {
  OUT_OF_CHECK_IN_RADIUS: "Sei troppo lontano. Avvicinati ancora un po'.",
  OUT_OF_RANGE: 'Sei fuori dal raggio. Avvicinati alla quest.',
  QUEST_ALREADY_COMPLETED: 'Hai già completato questa quest.',
  QUEST_INACTIVE: 'Questa quest non è attualmente disponibile.',
  OUT_OF_RANGE_ACCURACY: "GPS troppo impreciso. Spostati all'aperto e riprova.",
  STALE_FIX: 'Fix GPS scaduto. Attendi un aggiornamento della posizione.',
  GPS_REQUIRED: 'Posizione GPS obbligatoria per il check-in.',
};

function formatCheckInError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const code = (err.error as { error?: { code?: string } })?.error?.code;
    if (code && CHECK_IN_ERROR_MESSAGES[code]) return CHECK_IN_ERROR_MESSAGES[code];
    if (err.status === 0) return 'Connessione assente. Verifica la rete.';
    if (err.status === 422) return 'Posizione non accettata dal server.';
  }
  return 'Errore durante il check-in. Riprova.';
}
