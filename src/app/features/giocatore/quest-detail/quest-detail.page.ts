// Angular core
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
// Librerie esterne
import { IonContent, ModalController } from '@ionic/angular/standalone';
// Import locali
import {
  AnyQuest,
  CheckInResponse,
  PlayerQuestStatus,
  QuestType,
  SecondaryQuest,
} from '../../../core/services/quest/quest.types';
import { QuestService } from '../../../core/services/quest/quest.service';
import { GeolocationService } from '../../../core/services/geolocation/geolocation.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PlayerProfileService } from '../../../core/services/player-profile/player-profile.service';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { ScanModalComponent } from '../components/scan-modal/scan-modal.component';
import { CheckinSuccessModalComponent } from '../components/checkin-success-modal/checkin-success-modal.component';

type CheckInState = 'idle' | 'loading' | 'error';

/**
 * Quest Detail — pagina dedicata al dettaglio di una quest.
 *
 * Raggiunta via push da popup mappa / quest log (route giocatore/quest/:id).
 * Mostra in grande lo stato, il tipo, la descrizione e i punti, con l'azione
 * primaria (scansiona QR / check-in) e il feedback di distanza ed errore.
 *
 * I dati arrivano dal QuestService (signal reattivi): la quest e' derivata per
 * id; lo status e la distanza si aggiornano da soli. Se la pagina e' aperta a
 * freddo (deep link), in ngOnInit ricarichiamo quest e completamenti.
 */
@Component({
  selector: 'app-quest-detail',
  templateUrl: './quest-detail.page.html',
  styleUrls: ['./quest-detail.page.scss'],
  standalone: true,
  imports: [IonContent, DecimalPipe],
})
export class QuestDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly questService = inject(QuestService);
  private readonly geoService = inject(GeolocationService);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(PlayerProfileService);
  private readonly modalCtrl = inject(ModalController);
  private readonly haptics = inject(HapticsService);

  protected readonly QuestType = QuestType;

  private readonly questId = signal<string>('');
  protected readonly checkInState = signal<CheckInState>('idle');
  protected readonly checkInError = signal('');

  /** Quest corrente derivata per id dai dati reattivi del service. */
  protected readonly quest = computed<AnyQuest | undefined>(() =>
    this.questService.quests().find((q) => q.id === this.questId()),
  );

  /** Stato giocatore della quest (dipende anche dai completamenti). */
  protected readonly status = computed<PlayerQuestStatus>(() => {
    this.questService.completions();
    const q = this.quest();
    return q ? this.questService.playerStatusOf(q.id) : 'available';
  });

  protected readonly statusLabel = computed<string>(() => STATUS_LABELS[this.status()]);

  protected readonly typeLabel = computed<string>(() => {
    const q = this.quest();
    if (!q) return '';
    return q.type === QuestType.PRIMARY ? 'Quest principale · QR' : 'Quest secondaria · Check-in';
  });

  /** Distanza in metri (solo quest secondarie con GPS). */
  protected readonly distanceMeters = computed<number | null>(() => {
    const q = this.quest();
    if (!q || q.type !== QuestType.SECONDARY) return null;
    const pos = this.geoService.position();
    if (!pos) return null;
    const sec = q as SecondaryQuest;
    return haversineMeters(pos.lat, pos.lng, sec.position.lat, sec.position.lng);
  });

  protected readonly isInRange = computed<boolean>(() => {
    const q = this.quest();
    if (!q || q.type !== QuestType.SECONDARY) return false;
    const dist = this.distanceMeters();
    if (dist === null) return false;
    return dist <= (q as SecondaryQuest).checkInRadiusMeters;
  });

  protected readonly distanceLabel = computed<string>(() => {
    const dist = this.distanceMeters();
    if (dist === null) return 'GPS non disponibile';
    if (dist < 1000) return `${Math.round(dist)} m`;
    return `${(dist / 1000).toFixed(1).replace('.', ',')} km`;
  });

  ngOnInit(): void {
    this.questId.set(this.route.snapshot.paramMap.get('id') ?? '');
    // Deep link a freddo: assicura che i dati siano caricati.
    this.questService.loadQuests();
    this.questService.loadCompletions();
  }

  /** Torna alla schermata precedente (mappa / album). */
  protected back(): void {
    this.haptics.light();
    this.location.back();
  }

  protected retryCheckIn(): void {
    this.checkInState.set('idle');
    this.checkInError.set('');
  }

  /** Apre la modale di scansione QR per le quest primarie. */
  protected async openScanModal(): Promise<void> {
    const q = this.quest();
    if (!q) return;
    this.haptics.medium();
    const modal = await this.modalCtrl.create({
      component: ScanModalComponent,
      cssClass: 'tq-scan-modal',
      backdropDismiss: false,
      componentProps: { questId: q.id },
    });
    await modal.present();
  }

  /** Esegue il check-in per le quest secondarie. */
  protected checkIn(): void {
    const q = this.quest();
    if (!q || q.type !== QuestType.SECONDARY) return;

    const pos = this.geoService.position();
    if (!pos) {
      this.checkInError.set(
        'Posizione GPS non disponibile. Verifica che la localizzazione sia attiva.',
      );
      this.checkInState.set('error');
      this.haptics.error();
      return;
    }

    this.checkInState.set('loading');
    this.haptics.medium();

    this.questService.checkIn(q.id, { position: { lat: pos.lat, lng: pos.lng } }).subscribe({
      next: (response: CheckInResponse) => {
        this.authService.updateTotalPoints(response.totalPoints);
        this.profileService.reset();
        this.haptics.success();
        this.checkInState.set('idle');
        void this.openSuccessModal(q.name, response);
      },
      error: (err: unknown) => {
        this.checkInError.set(formatCheckInError(err));
        this.checkInState.set('error');
        this.haptics.error();
      },
    });
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

const STATUS_LABELS: Record<PlayerQuestStatus, string> = {
  discovered: 'Scoperta',
  available: 'Da scoprire',
  locked: 'Bloccata',
};

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
