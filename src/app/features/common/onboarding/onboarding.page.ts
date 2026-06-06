import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';
import { HttpClient } from '@angular/common/http';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  arrowBackOutline,
  checkmarkCircle,
  lockClosed,
  lockOpen,
  logoGoogle,
  bookOutline,
  trophyOutline,
  albumsOutline,
  starOutline,
  qrCodeOutline,
} from 'ionicons/icons';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';
import { TqButtonComponent } from '../../../shared/components/tq-button/tq-button.component';
import { environment } from '../../../../environments/environment';

const PARTICLE_ANGLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
const PARTICLE_TRAVELS = [90, 110, 75, 125, 85, 100, 95, 115, 80, 105];

const TOTAL_STEPS = 6;
// Indice step "Guadagna e Sali di Livello" nel carosello
const LEVEL_UP_STEP_INDEX = 3;

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss',
  standalone: true,
  imports: [IonIcon, TqButtonComponent],
})
export class OnboardingPage implements OnDestroy {
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  protected readonly particleAngles = PARTICLE_ANGLES;
  protected readonly particleTravels = PARTICLE_TRAVELS;
  // Percentuale di spostamento del track per ogni step (6 step → track 600%)
  protected readonly stepPct = 100 / TOTAL_STEPS;

  protected readonly currentStep = signal(0);

  // Step livello — 0=idle, 1=riempimento veloce→decelerazione, 2=leveled-up
  protected readonly levelUpPhase = signal(0);

  // Step taccuino
  protected readonly pressProgress = signal(0);
  protected readonly notebookUnlocked = signal(false);
  protected readonly showFlash = signal(false);
  protected readonly showSuccess = signal(false);
  protected readonly showParticles = signal(false);

  private pressInterval: ReturnType<typeof setInterval> | null = null;
  private pressTimer500: ReturnType<typeof setTimeout> | null = null;
  private pressTimer1000: ReturnType<typeof setTimeout> | null = null;
  private pressActive = false;
  private levelUpTimers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    addIcons({
      arrowForwardOutline,
      arrowBackOutline,
      checkmarkCircle,
      lockClosed,
      lockOpen,
      logoGoogle,
      bookOutline,
      trophyOutline,
      albumsOutline,
      starOutline,
      qrCodeOutline,
    });
  }

  ngOnDestroy(): void {
    this.clearPressTimers();
    this.levelUpTimers.forEach((t) => clearTimeout(t));
  }

  protected goToStep(index: number): void {
    this.currentStep.set(index);
    if (index === LEVEL_UP_STEP_INDEX) {
      this.startLevelUpAnimation();
    } else {
      this.levelUpTimers.forEach((t) => clearTimeout(t));
      this.levelUpTimers = [];
      this.levelUpPhase.set(0);
    }
  }

  private startLevelUpAnimation(): void {
    this.levelUpTimers.forEach((t) => clearTimeout(t));
    this.levelUpTimers = [];
    this.levelUpPhase.set(0);

    this.levelUpTimers.push(setTimeout(() => this.levelUpPhase.set(1), 300));

    // Zip haptic: 20 impatti con gap esponenziale (15ms → 116ms, ratio 1.12).
    // Le prime 10 battute sono quasi un buzz continuo (bar 0→50%, fase veloce),
    // le 6 medium allargano la sensazione (bar 50→80%), le 4 heavy chiudono
    // pesanti (bar 80→100%). Specchia la decelerazione della barra CSS.
    // Offset assoluti = 300ms (delay animazione) + offset relativo da 0ms
    const zip: [number, () => Promise<void>][] = [
      [300 + 0, () => this.haptics.tapLight()],
      [300 + 15, () => this.haptics.tapLight()],
      [300 + 32, () => this.haptics.tapLight()],
      [300 + 51, () => this.haptics.tapLight()],
      [300 + 72, () => this.haptics.tapLight()],
      [300 + 96, () => this.haptics.tapLight()],
      [300 + 123, () => this.haptics.tapLight()],
      [300 + 153, () => this.haptics.tapLight()],
      [300 + 187, () => this.haptics.tapLight()],
      [300 + 225, () => this.haptics.tapLight()],
      [300 + 267, () => this.haptics.tapMedium()],
      [300 + 314, () => this.haptics.tapMedium()],
      [300 + 367, () => this.haptics.tapMedium()],
      [300 + 426, () => this.haptics.tapMedium()],
      [300 + 492, () => this.haptics.tapMedium()],
      [300 + 566, () => this.haptics.tapMedium()],
      [300 + 649, () => this.haptics.tapHeavy()],
      [300 + 742, () => this.haptics.tapHeavy()],
      [300 + 846, () => this.haptics.tapHeavy()],
      [300 + 962, () => this.haptics.tapHeavy()],
    ];
    zip.forEach(([ms, fn]) => {
      this.levelUpTimers.push(setTimeout(() => void fn(), ms));
    });

    // Level up appena l'animazione finisce (300 + 1000 + 100)
    this.levelUpTimers.push(
      setTimeout(() => {
        void this.haptics.levelUp();
        this.audio.playLevelUp();
        this.levelUpPhase.set(2);
      }, 1400),
    );
  }

  protected nextStep(): void {
    const next = this.currentStep() + 1;
    if (next < TOTAL_STEPS) {
      void this.haptics.tapMedium();
      this.audio.playTap();
      this.goToStep(next);
    }
  }

  protected goBack(): void {
    const prev = this.currentStep() - 1;
    if (prev >= 0) {
      void this.haptics.tapLight();
      this.goToStep(prev);
    }
  }

  protected skip(): void {
    void this.haptics.tapLight();
    this.goToStep(TOTAL_STEPS - 1);
  }

  protected onSealPressStart(): void {
    if (this.notebookUnlocked()) return;
    this.pressActive = true;
    this.pressProgress.set(0);
    const startTime = Date.now();

    this.pressInterval = setInterval(() => {
      if (!this.pressActive) return;
      const elapsed = Date.now() - startTime;
      this.pressProgress.set(Math.min((elapsed / 1500) * 100, 100));
    }, 16);

    this.pressTimer500 = setTimeout(() => {
      if (this.pressActive) void this.haptics.tapLight();
    }, 500);

    this.pressTimer1000 = setTimeout(() => {
      if (this.pressActive) void this.haptics.tapMedium();
    }, 1000);

    setTimeout(() => {
      if (!this.pressActive) return;
      void this.completeSealPress();
    }, 1500);
  }

  protected onSealPressEnd(): void {
    if (this.notebookUnlocked()) return;
    this.pressActive = false;
    this.clearPressTimers();
    if (this.pressProgress() < 100) this.pressProgress.set(0);
  }

  private async completeSealPress(): Promise<void> {
    this.pressActive = false;
    this.clearPressTimers();
    this.pressProgress.set(100);

    void this.haptics.tapHeavy();
    await this.haptics.collectibleUnlock();
    this.audio.playStamp();

    this.showFlash.set(true);
    setTimeout(() => this.showFlash.set(false), 300);
    setTimeout(() => {
      this.notebookUnlocked.set(true);
      this.showParticles.set(true);
      this.showSuccess.set(true);
    }, 200);
    setTimeout(() => this.showParticles.set(false), 1400);
  }

  private clearPressTimers(): void {
    if (this.pressInterval) {
      clearInterval(this.pressInterval);
      this.pressInterval = null;
    }
    if (this.pressTimer500) {
      clearTimeout(this.pressTimer500);
      this.pressTimer500 = null;
    }
    if (this.pressTimer1000) {
      clearTimeout(this.pressTimer1000);
      this.pressTimer1000 = null;
    }
  }

  protected async registerWithEmail(): Promise<void> {
    void this.haptics.tapHeavy();
    await this.router.navigate(['/giocatore/register']);
  }

  protected async registerWithGoogle(): Promise<void> {
    void this.haptics.tapHeavy();
    await this.router.navigate(['/giocatore/register']);
  }

  protected async registerAsVenue(): Promise<void> {
    void this.haptics.tapLight();
    await this.router.navigate(['/attivita/register']);
  }

  protected async onRegistrationComplete(): Promise<void> {
    await Preferences.set({ key: 'onboardingDone', value: 'true' });
    this.http.post(`${environment.apiUrl}/onboarding/complete`, {}).subscribe({
      error: () => {
        /* non bloccante */
      },
    });
    await this.router.navigate(['/giocatore/home']);
  }
}
