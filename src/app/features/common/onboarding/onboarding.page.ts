import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { PlayerClass } from '@trentino-quest/shared-types';
import { AuthService } from '../../../core/services/auth/auth.service';
import { OnboardingService } from '../../../core/services/onboarding/onboarding.service';
import { HapticsService } from '../../../core/services/haptics/haptics.service';

/** Fasi del flusso di onboarding (GDD 1.1–1.5). */
type Phase = 1 | 2 | 3 | 4 | 5;

/** Zona di prossimita' del radar didattico (Fase 2). */
type RadarZone = 'far' | 'mid' | 'near';

interface ClassOption {
  id: PlayerClass;
  label: string;
  hint: string;
  icon: string;
}

const CLASS_OPTIONS: ClassOption[] = [
  {
    id: PlayerClass.CASTLE_HUNTER,
    label: 'Cacciatore di Castelli',
    hint: 'Rocche, manieri, storia',
    icon: 'castle',
  },
  {
    id: PlayerClass.FOREST_KEEPER,
    label: 'Custode dei Boschi',
    hint: 'Sentieri, fauna, natura',
    icon: 'leaf',
  },
  {
    id: PlayerClass.URBAN_EXPLORER,
    label: 'Esploratore Urbano',
    hint: 'Borghi, piazze, cultura',
    icon: 'city',
  },
];

/** Durata del long-press di validazione (Fase 3), in millisecondi. */
const SEAL_PRESS_MS = 2000;

/** Codici errore del backend gestiti nel form di registrazione (Fase 5). */
const ERR_EMAIL_EXISTS = 'EMAIL_ALREADY_EXISTS';
const ERR_USERNAME_TAKEN = 'USERNAME_ALREADY_TAKEN';

/**
 * OnboardingPage — flusso di attivazione in 5 fasi (GDD sezione 1).
 *
 * 1. Scelta identita' (classe) con bussola animata.
 * 2. Radar didattico "clicca-e-vibra": trascina per trovare il punto nascosto,
 *    colore e cadenza aptica modulati dalla distanza.
 * 3. Simulazione validazione GPS: long-press 2s sul sigillo con barra circolare
 *    e intensita' aptica crescente.
 * 4. Momento WOW: taccuino che si apre, coriandoli, timbro che cala, primo
 *    collezionabile + ricompensa.
 * 5. Lazy registration: salva i progressi (registrazione) oppure azzera.
 *
 * Tutto il feedback aptico passa da HapticsService. Le animazioni sono CSS/SVG
 * (nessuna libreria 3D), coerenti col design system TQ.
 */
@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: true,
  imports: [IonContent, ReactiveFormsModule],
})
export class OnboardingPage implements OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly onboarding = inject(OnboardingService);
  private readonly haptics = inject(HapticsService);
  private readonly toastCtrl = inject(ToastController);
  private readonly fb = inject(FormBuilder);

  // -- Stato generale ---------------------------------------------------

  protected readonly phase = signal<Phase>(1);
  protected readonly classOptions = CLASS_OPTIONS;
  protected readonly selectedClass = signal<PlayerClass | null>(null);

  // -- Fase 2: radar ----------------------------------------------------

  /** Punto nascosto, in coordinate normalizzate [0,1] relative al radar. */
  private hiddenX = 0.5;
  private hiddenY = 0.5;
  protected readonly radarZone = signal<RadarZone>('far');
  protected readonly radarFlash = signal(false);
  private radarTimer: ReturnType<typeof setInterval> | null = null;
  private radarSolved = false;

  // -- Fase 3: sigillo --------------------------------------------------

  protected readonly sealProgress = signal(0); // 0..1
  protected readonly sealValidated = signal(false);
  /** Circonferenza dell'anello di progresso del sigillo (r=46). */
  protected readonly sealCircumference = 2 * Math.PI * 46;
  private sealRaf: number | null = null;
  private sealStart = 0;
  private sealHapticStep = 0;

  // -- Fase 4: WOW ------------------------------------------------------

  protected readonly stamped = signal(false);
  /** Pezzi di coriandoli: angolo + distanza + ritardo, animati via CSS. */
  protected readonly confetti = Array.from({ length: 18 }, (_, i) => ({
    angle: (360 / 18) * i,
    travel: 80 + ((i * 37) % 70),
    delay: (i % 6) * 60,
    hue: [0, 1, 2, 3][i % 4],
  }));

  // -- Fase 5: registrazione -------------------------------------------

  protected readonly showRegister = signal(false);
  protected readonly submitting = signal(false);
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnDestroy(): void {
    this.clearRadarTimer();
    this.cancelSealRaf();
  }

  // =====================================================================
  // FASE 1 — Scelta identita'
  // =====================================================================

  protected selectClass(option: ClassOption): void {
    this.haptics.light(); // tap secco ~10ms
    this.selectedClass.set(option.id);
  }

  protected confirmClass(): void {
    if (!this.selectedClass()) return;
    this.haptics.medium();
    this.goToPhase(2);
  }

  // =====================================================================
  // FASE 2 — Radar didattico
  // =====================================================================

  private startRadar(): void {
    this.radarSolved = false;
    this.radarFlash.set(false);
    this.radarZone.set('far');
    // Punto nascosto entro il 30% del raggio dal centro.
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.3;
    this.hiddenX = 0.5 + Math.cos(angle) * r;
    this.hiddenY = 0.5 + Math.sin(angle) * r;
  }

  protected onRadarMove(event: PointerEvent): void {
    if (this.radarSolved) return;
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const dist = Math.hypot(x - this.hiddenX, y - this.hiddenY);
    // Frazione rispetto al raggio del cerchio (0.5 in coordinate normalizzate).
    const frac = Math.min(1, dist / 0.5);

    if (frac < 0.06) {
      this.solveRadar();
      return;
    }

    const zone: RadarZone = frac < 0.2 ? 'near' : frac < 0.5 ? 'mid' : 'far';
    if (zone !== this.radarZone()) {
      this.radarZone.set(zone);
      this.restartRadarTimer(zone);
    }
  }

  protected onRadarLeave(): void {
    if (this.radarSolved) return;
    this.radarZone.set('far');
    this.clearRadarTimer();
  }

  private restartRadarTimer(zone: RadarZone): void {
    this.clearRadarTimer();
    if (zone === 'mid') {
      // Pulsazione lenta (battito cardiaco) ogni 500ms.
      this.radarTimer = setInterval(() => this.haptics.dynamic(0.4), 500);
    } else if (zone === 'near') {
      // Pulsazione rapida e continua ogni 100ms.
      this.radarTimer = setInterval(() => this.haptics.dynamic(0.9), 100);
    }
  }

  private clearRadarTimer(): void {
    if (this.radarTimer !== null) {
      clearInterval(this.radarTimer);
      this.radarTimer = null;
    }
  }

  private solveRadar(): void {
    this.radarSolved = true;
    this.clearRadarTimer();
    this.haptics.success();
    this.radarFlash.set(true);
    // Dopo il flash, passa alla fase del sigillo.
    setTimeout(() => this.goToPhase(3), 700);
  }

  // =====================================================================
  // FASE 3 — Validazione GPS (long-press)
  // =====================================================================

  protected onSealPressStart(): void {
    if (this.sealValidated()) return;
    this.sealStart = performance.now();
    this.sealHapticStep = 0;
    this.haptics.light();
    this.tickSeal();
  }

  protected onSealPressEnd(): void {
    if (this.sealValidated()) return;
    this.cancelSealRaf();
    this.sealProgress.set(0);
  }

  private tickSeal(): void {
    this.sealRaf = requestAnimationFrame(() => {
      const elapsed = performance.now() - this.sealStart;
      const progress = Math.min(1, elapsed / SEAL_PRESS_MS);
      this.sealProgress.set(progress);

      // Intensita' aptica crescente a step.
      if (progress >= 0.66 && this.sealHapticStep < 2) {
        this.sealHapticStep = 2;
        this.haptics.heavy();
      } else if (progress >= 0.33 && this.sealHapticStep < 1) {
        this.sealHapticStep = 1;
        this.haptics.medium();
      }

      if (progress >= 1) {
        this.completeSeal();
      } else {
        this.tickSeal();
      }
    });
  }

  private completeSeal(): void {
    this.cancelSealRaf();
    this.sealValidated.set(true);
    this.haptics.success();
    setTimeout(() => this.goToPhase(4), 900);
  }

  private cancelSealRaf(): void {
    if (this.sealRaf !== null) {
      cancelAnimationFrame(this.sealRaf);
      this.sealRaf = null;
    }
  }

  // =====================================================================
  // FASE 4 — Momento WOW
  // =====================================================================

  protected stampNotebook(): void {
    if (this.stamped()) return;
    this.haptics.heavy(); // colpo secco e pesante ~80ms
    this.stamped.set(true);
  }

  // =====================================================================
  // FASE 5 — Lazy registration
  // =====================================================================

  protected openRegister(): void {
    this.haptics.medium();
    this.showRegister.set(true);
  }

  protected async cancelProgress(): Promise<void> {
    const ok = window.confirm('Vuoi davvero cancellare i progressi e ricominciare?');
    if (!ok) return;
    this.haptics.warning();
    this.resetFlow();
  }

  protected submitRegister(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const playerClass = this.selectedClass();
    if (!playerClass) {
      this.goToPhase(1);
      return;
    }

    this.submitting.set(true);
    const { email, username, password } = this.form.getRawValue();
    this.authService
      .registerPlayer({ email: email!, username: username!, password: password! })
      .subscribe({
        next: () => this.finalizeOnboarding(playerClass),
        error: (err) => {
          this.submitting.set(false);
          void this.handleRegisterError(err);
        },
      });
  }

  /**
   * Dopo la registrazione: imposta la classe scelta, completa l'onboarding
   * lato server (assegna collezionabile/XP/monete) e naviga alla home.
   * class/complete sono best-effort: anche in caso di errore l'utente e'
   * gia' registrato e autenticato, quindi procediamo comunque.
   */
  private finalizeOnboarding(playerClass: PlayerClass): void {
    void this.onboarding.markSeen();
    this.onboarding.setPlayerClass(playerClass).subscribe({
      next: () => this.completeAndGoHome(playerClass),
      error: () => this.completeAndGoHome(playerClass),
    });
  }

  private completeAndGoHome(playerClass: PlayerClass): void {
    this.onboarding.complete(playerClass).subscribe({
      next: () => this.goHome(),
      error: () => this.goHome(),
    });
  }

  private goHome(): void {
    this.submitting.set(false);
    void this.router.navigate(['/giocatore/home'], { replaceUrl: true });
  }

  /** Vai al login (utente che ha gia' un account). */
  protected async goToLogin(): Promise<void> {
    await this.onboarding.markSeen();
    void this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  /** Chiudi l'onboarding e torna alla landing (escape per l'ospite). */
  protected async skip(): Promise<void> {
    await this.onboarding.markSeen();
    void this.router.navigate(['/'], { replaceUrl: true });
  }

  // =====================================================================
  // Helper
  // =====================================================================

  private goToPhase(phase: Phase): void {
    this.phase.set(phase);
    if (phase === 2) this.startRadar();
  }

  private resetFlow(): void {
    this.clearRadarTimer();
    this.cancelSealRaf();
    this.selectedClass.set(null);
    this.radarZone.set('far');
    this.radarFlash.set(false);
    this.radarSolved = false;
    this.sealProgress.set(0);
    this.sealValidated.set(false);
    this.stamped.set(false);
    this.showRegister.set(false);
    this.form.reset();
    this.phase.set(1);
  }

  private async handleRegisterError(err: unknown): Promise<void> {
    let message = 'Registrazione non riuscita. Riprova.';
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { code?: string; message?: string } | null;
      if (body?.code === ERR_EMAIL_EXISTS) message = 'Email già registrata.';
      else if (body?.code === ERR_USERNAME_TAKEN) message = 'Username già in uso.';
      else if (body?.message) message = body.message;
    }
    const toast = await this.toastCtrl.create({
      message,
      duration: 2600,
      position: 'bottom',
      cssClass: 'tq-toast',
    });
    await toast.present();
  }
}
