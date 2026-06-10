import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  navigateOutline,
  qrCodeOutline,
  flashOutline,
  albumsOutline,
  locateOutline,
  compassOutline,
  flameOutline,
  flame,
} from 'ionicons/icons';
import {
  AnyQuest,
  CheckInResponse,
  PlayerQuestStatus,
  QuestType,
  PrimaryQuest,
  SecondaryQuest,
} from '../../../../core/services/quest/quest.types';
import { QuestService } from '../../../../core/services/quest/quest.service';
import { GeolocationService } from '../../../../core/services/geolocation/geolocation.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { PlayerProfileService } from '../../../../core/services/player-profile/player-profile.service';
import { HapticsService } from '../../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../../core/services/audio.service';
import { haversineMeters } from '../../../../core/utils/geo';
import { formatCheckInError } from '../../../../core/utils/check-in-errors';
import { TqButtonComponent } from '../../../../shared/components/tq-button/tq-button.component';
import { TqBadgeComponent } from '../../../../shared/components/tq-badge/tq-badge.component';
import { ScanModalComponent } from '../scan-modal/scan-modal.component';
import { CheckinSuccessModalComponent } from '../checkin-success-modal/checkin-success-modal.component';

type ProximityZone = 'outside_area' | 'warm' | 'hot' | 'burning';
type CheckInState = 'idle' | 'loading' | 'error';

@Component({
  selector: 'app-quest-detail-sheet',
  templateUrl: './quest-detail-sheet.component.html',
  styleUrls: ['./quest-detail-sheet.component.scss'],
  standalone: true,
  imports: [IonIcon, TqButtonComponent, TqBadgeComponent],
})
export class QuestDetailSheetComponent implements OnInit, OnDestroy {
  @Input() quest: AnyQuest | null = null;
  @Input() status: PlayerQuestStatus = 'available';

  private readonly geoService = inject(GeolocationService);
  private readonly questService = inject(QuestService);
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(PlayerProfileService);
  private readonly modalCtrl = inject(ModalController);

  protected readonly QuestType = QuestType;
  protected readonly checkInState = signal<CheckInState>('idle');
  protected readonly checkInError = signal('');
  protected readonly proximityZone = signal<ProximityZone>('outside_area');
  protected readonly showProximity = signal(false);

  private proximityInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly distanceMeters = computed<number | null>(() => {
    const q = this.quest;
    if (!q) return null;
    const pos = this.geoService.position();
    if (!pos) return null;
    const lat =
      q.type === QuestType.PRIMARY
        ? (q as PrimaryQuest).searchArea.lat
        : (q as SecondaryQuest).position.lat;
    const lng =
      q.type === QuestType.PRIMARY
        ? (q as PrimaryQuest).searchArea.lng
        : (q as SecondaryQuest).position.lng;
    return Math.round(haversineMeters(pos.lat, pos.lng, lat, lng));
  });

  protected readonly isInRange = computed<boolean>(() => {
    const q = this.quest;
    if (!q) return false;
    const dist = this.distanceMeters();
    if (dist === null) return false;
    const radius =
      q.type === QuestType.PRIMARY
        ? (q as PrimaryQuest).searchRadiusMeters
        : (q as SecondaryQuest).checkInRadiusMeters;
    return dist <= radius;
  });

  protected readonly distanceLabel = computed<string>(() => {
    const dist = this.distanceMeters();
    if (dist === null) return 'GPS non disponibile';
    if (dist < 1000) return `a ${dist} m`;
    return `a ${(dist / 1000).toFixed(1).replace('.', ',')} km`;
  });

  protected get isPrimary(): boolean {
    return this.quest?.type === QuestType.PRIMARY;
  }

  protected get searchRadius(): number | null {
    if (!this.quest || this.quest.type !== QuestType.PRIMARY) return null;
    return (this.quest as PrimaryQuest).searchRadiusMeters;
  }

  constructor() {
    addIcons({
      navigateOutline,
      qrCodeOutline,
      flashOutline,
      albumsOutline,
      locateOutline,
      compassOutline,
      flameOutline,
      flame,
    });
  }

  ngOnInit(): void {
    if (this.quest?.type === QuestType.PRIMARY) {
      this.checkProximity();
      this.proximityInterval = setInterval(() => this.checkProximity(), 6000);
    }
  }

  ngOnDestroy(): void {
    if (this.proximityInterval !== null) {
      clearInterval(this.proximityInterval);
      this.proximityInterval = null;
    }
  }

  private checkProximity(): void {
    const q = this.quest;
    if (!q || q.type !== QuestType.PRIMARY) return;
    const pos = this.geoService.position();
    if (!pos) return;

    const primary = q as PrimaryQuest;
    const dist = haversineMeters(pos.lat, pos.lng, primary.searchArea.lat, primary.searchArea.lng);
    const r = primary.searchRadiusMeters;

    if (dist > r) {
      if (this.showProximity()) this.showProximity.set(false);
      if (this.proximityZone() !== 'outside_area') this.proximityZone.set('outside_area');
      return;
    }

    this.showProximity.set(true);
    let zone: ProximityZone;
    if (dist <= r * 0.15) zone = 'burning';
    else if (dist <= r * 0.4) zone = 'hot';
    else zone = 'warm';

    const prev = this.proximityZone();
    if (zone !== prev) {
      this.proximityZone.set(zone);
      if (zone === 'warm') void this.haptics.proximityWarm();
      else if (zone === 'hot') void this.haptics.proximityHot();
      else if (zone === 'burning') void this.haptics.proximityBurning();
    }
  }

  protected async doAction(): Promise<void> {
    const q = this.quest;
    if (!q || this.status !== 'available') return;

    if (q.type === QuestType.PRIMARY) {
      void this.haptics.tapHeavy();
      const modal = await this.modalCtrl.create({
        component: ScanModalComponent,
        cssClass: 'tq-scan-modal',
        backdropDismiss: false,
        componentProps: { questId: q.id },
      });
      await modal.present();
      return;
    }

    const pos = this.geoService.position();
    if (!pos) {
      this.checkInError.set(
        'Posizione GPS non disponibile. Verifica che la localizzazione sia attiva.',
      );
      this.checkInState.set('error');
      return;
    }

    void this.haptics.tapHeavy();
    this.checkInState.set('loading');

    this.questService.checkIn(q.id, { position: { lat: pos.lat, lng: pos.lng } }).subscribe({
      next: async (response: CheckInResponse) => {
        this.authService.updateAfterCompletion(response.totalPoints, response.gamification);
        this.profileService.reset();
        void this.haptics.success();
        this.audio.playSuccess();
        await this.openSuccessModal(q.name, response);
        await this.modalCtrl.dismiss();
      },
      error: (err: unknown) => {
        void this.haptics.error();
        this.audio.playError();
        this.checkInError.set(formatCheckInError(err));
        this.checkInState.set('error');
      },
    });
  }

  protected retryCheckIn(): void {
    this.checkInState.set('idle');
    this.checkInError.set('');
  }

  protected async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
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
