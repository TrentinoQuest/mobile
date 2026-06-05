import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, ModalController } from '@ionic/angular/standalone';
import type { ScanQrResponse } from '@trentino-quest/shared-types';
import { ScanService, type ScanError } from '../../../../core/services/scan/scan.service';
import { PlayerProfileService } from '../../../../core/services/player-profile/player-profile.service';
import { QuestService } from '../../../../core/services/quest/quest.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { StreakMilestoneModalComponent } from '../streak-milestone-modal/streak-milestone-modal.component';
import { LevelUpModalComponent } from '../level-up-modal/level-up-modal.component';

type ScanState = 'no-context' | 'idle' | 'submitting' | 'success' | 'error';

/** Categoria di errore usata per differenziare l'UI della schermata errore. */
type ErrorCategory = 'already-done' | 'distance' | 'gps' | 'qr' | 'generic';

// Stesse palette dell'album — art exception, hex diretti
const PALETTES = [
  { skyTop: '#2A3A4A', skyBot: '#0A1520', sun: '#4A8AB0', mid: '#1A2F40', fg: '#0D1A24' },
  { skyTop: '#3A2A18', skyBot: '#121212', sun: '#C8930F', mid: '#3A2A18', fg: '#26190E' },
  { skyTop: '#1A2A1A', skyBot: '#080D08', sun: '#5A9040', mid: '#1A3018', fg: '#0D180D' },
  { skyTop: '#2A1A2E', skyBot: '#100810', sun: '#8A4AB0', mid: '#241830', fg: '#180D20' },
  { skyTop: '#3A2014', skyBot: '#140A06', sun: '#C05828', mid: '#381A10', fg: '#22100A' },
  { skyTop: '#1A2830', skyBot: '#080E12', sun: '#3A8A7A', mid: '#183028', fg: '#0D1C1A' },
];

const GPS_ERROR_CODES = new Set(['GPS_UNAVAILABLE', 'OUT_OF_RANGE_ACCURACY', 'STALE_FIX']);
const QR_ERROR_CODES = new Set([
  'INVALID_QR_TOKEN',
  'QR_QUEST_MISMATCH',
  'QR_EXPIRED',
  'QUEST_NOT_PLACED',
  'COLLECTIBLE_MISSING',
]);

/** Angoli di dispersione delle 16 particelle (gradi) */
const PARTICLE_ANGLES = [0, 22, 45, 68, 90, 112, 135, 158, 180, 202, 225, 248, 270, 292, 315, 338];
/** Distanza percorsa da ogni particella (px) — alternanza per varietà */
const PARTICLE_TRAVELS = [
  130, 110, 150, 95, 140, 115, 160, 100, 125, 145, 90, 135, 155, 105, 120, 165,
];
/** Posizioni [x%, y%, delay_index] delle stelline decorative */
const STAR_POSITIONS: [number, number, number][] = [
  [18, 22, 0],
  [78, 18, 2],
  [12, 55, 4],
  [85, 48, 1],
  [22, 78, 3],
  [75, 72, 5],
  [50, 15, 6],
  [48, 82, 7],
];

@Component({
  selector: 'app-scan-modal',
  templateUrl: './scan-modal.component.html',
  styleUrls: ['./scan-modal.component.scss'],
  standalone: true,
  imports: [IonContent, UpperCasePipe],
})
export class ScanModalComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly scanService = inject(ScanService);
  private readonly profileService = inject(PlayerProfileService);
  private readonly questService = inject(QuestService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly particleAngles = PARTICLE_ANGLES;
  protected readonly particleTravels = PARTICLE_TRAVELS;
  protected readonly starPositions = STAR_POSITIONS;

  /** ID della quest da completare. Null quando aperto dalla navbar senza contesto. */
  @Input() questId: string | null = null;

  protected readonly state = signal<ScanState>('idle');
  protected readonly scanResult = signal<ScanQrResponse | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly errorCode = signal('');

  protected readonly palette = computed(() => {
    const name = this.scanResult()?.collectible?.name ?? '';
    return PALETTES[name.length % PALETTES.length];
  });

  // Contatori derivati da questService (sempre caricato) invece che da profileService
  // (che viene azzerato con reset() subito dopo la scansione).
  // Dopo addCompletion() il length è N+1, quindi N+1-1 = N = conta prima di questo unlock.
  protected readonly prevCount = computed(() =>
    Math.max(0, this.questService.completions().length - 1),
  );
  protected readonly totalCount = computed(() => this.questService.totalCount());

  protected readonly errorCategory = computed<ErrorCategory>(() => {
    const code = this.errorCode();
    if (code === 'QUEST_ALREADY_COMPLETED') return 'already-done';
    if (code === 'OUT_OF_VALIDATION_RADIUS') return 'distance';
    if (GPS_ERROR_CODES.has(code)) return 'gps';
    if (QR_ERROR_CODES.has(code)) return 'qr';
    return 'generic';
  });

  ngOnInit(): void {
    if (this.questId) {
      this.startScan();
    } else {
      this.state.set('no-context');
    }
  }

  async startScan(): Promise<void> {
    if (!this.questId) {
      this.state.set('no-context');
      return;
    }
    this.state.set('submitting');
    try {
      const result = await this.scanService.scanAndSubmit(this.questId);
      // Aggiorna i signal reattivi: mappa → marker diventa 'discovered',
      // header → punti/XP/streak aggiornati, senza attendere il prossimo loadCompletions.
      this.questService.addCompletion(result.completion);
      this.authService.updateAfterCompletion(result.totalPoints, result.gamification);
      this.scanResult.set(result);
      // Invalida cache per forzare reload alla prossima apertura album/profilo
      this.profileService.reset();
      this.state.set('success');
    } catch (err: unknown) {
      const scanErr = err as ScanError;
      if (scanErr.code === 'CANCELLED') {
        await this.dismiss();
        return;
      }
      this.errorCode.set(scanErr.code ?? '');
      this.errorMessage.set(scanErr.message || 'Errore sconosciuto. Riprova.');
      this.state.set('error');
    }
  }

  async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }

  async continueExploring(): Promise<void> {
    const result = this.scanResult();
    const gamification = result?.gamification;
    const showLevelUp = gamification?.newLevel != null;
    const showStreak =
      gamification != null &&
      gamification.currentStreak > 0 &&
      !gamification.streakBroken;

    await this.modalCtrl.dismiss({ success: true });

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
      await streakModal.onDidDismiss();
    }

    await this.router.navigate(['/giocatore/album']);
  }

  retryFromError(): void {
    this.startScan();
  }
}
