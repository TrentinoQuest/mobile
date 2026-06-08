import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  eyeOutline,
  eyeOffOutline,
  locateOutline,
  checkmarkCircle,
} from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  BusinessType,
  BUSINESS_TYPE_LABEL,
  RegisterBusinessRequest,
} from '../../../core/services/business/business.types';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'app-register-business',
  templateUrl: './register-business.page.html',
  styleUrls: ['./register-business.page.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonContent, IonIcon, IonSpinner],
})
export class RegisterBusinessPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);

  readonly submitting = signal(false);
  readonly passwordVisible = signal(false);
  readonly confirmPasswordVisible = signal(false);
  readonly emailAlreadyExists = signal(false);
  readonly detectingLocation = signal(false);
  readonly shakeForm = signal(false);

  private detectedPosition: { lat: number; lng: number } | null = null;
  readonly locationDetected = signal(false);

  readonly businessTypes: { value: BusinessType; label: string }[] = Object.entries(
    BUSINESS_TYPE_LABEL,
  ).map(([value, label]) => ({ value: value as BusinessType, label }));

  readonly form: FormGroup = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      businessName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      businessType: ['restaurant', [Validators.required]],
      address: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(200)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  constructor() {
    addIcons({ arrowBackOutline, eyeOutline, eyeOffOutline, locateOutline, checkmarkCircle });
    this.form.get('email')?.valueChanges.subscribe(() => {
      if (this.emailAlreadyExists()) this.emailAlreadyExists.set(false);
    });
  }

  goBack(): void {
    void this.router.navigate(['/']);
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible.update((v) => !v);
  }

  detectLocation(): void {
    if (!navigator.geolocation) {
      void this.showToast('Geolocalizzazione non supportata dal browser.', 'warning');
      return;
    }
    void this.haptics.tapMedium();
    this.detectingLocation.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.detectedPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.locationDetected.set(true);
        this.detectingLocation.set(false);
        void this.haptics.success();
      },
      () => {
        this.detectingLocation.set(false);
        void this.haptics.error();
        void this.showToast(
          'Impossibile rilevare la posizione. Abilita la geolocalizzazione e riprova.',
          'warning',
        );
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      if (this.form.invalid) void this.haptics.error();
      return;
    }

    if (!this.detectedPosition) {
      void this.haptics.warning();
      await this.showToast('Rileva la tua posizione prima di procedere.', 'warning');
      return;
    }

    void this.haptics.tapHeavy();
    this.audio.playTap();
    this.submitting.set(true);
    this.emailAlreadyExists.set(false);

    const request: RegisterBusinessRequest = {
      email: this.form.value.email.trim(),
      password: this.form.value.password,
      businessName: this.form.value.businessName.trim(),
      businessType: this.form.value.businessType,
      address: this.form.value.address.trim(),
      position: this.detectedPosition,
    };

    this.authService.registerBusiness(request).subscribe({
      next: () => {
        void this.haptics.success();
        this.audio.playSuccess();
        void this.router.navigate(['/attivita/pending']);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        void this.handleRegistrationError(err);
      },
    });
  }

  private async handleRegistrationError(err: HttpErrorResponse): Promise<void> {
    const code = err.error?.code as string | undefined;

    if (err.status === 409) {
      if (code === 'EMAIL_ALREADY_EXISTS' || !code) {
        this.emailAlreadyExists.set(true);
        return;
      }
      await this.showToast('Email già registrata.', 'danger');
      return;
    }

    void this.haptics.error();
    this.audio.playError();
    this.shakeForm.set(true);
    setTimeout(() => this.shakeForm.set(false), 400);

    if (err.status === 400) {
      await this.showToast('Dati non validi. Controlla i campi.', 'danger');
      return;
    }
    await this.showToast('Si è verificato un errore. Riprova più tardi.', 'danger');
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3500,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  get email(): AbstractControl {
    return this.form.get('email')!;
  }
  get businessName(): AbstractControl {
    return this.form.get('businessName')!;
  }
  get businessType(): AbstractControl {
    return this.form.get('businessType')!;
  }
  get address(): AbstractControl {
    return this.form.get('address')!;
  }
  get password(): AbstractControl {
    return this.form.get('password')!;
  }
  get confirmPassword(): AbstractControl {
    return this.form.get('confirmPassword')!;
  }
  get passwordsMismatch(): boolean {
    return this.form.errors?.['passwordsMismatch'] === true && this.confirmPassword.touched;
  }
}

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const cpw = group.get('confirmPassword')?.value;
  if (!pw || !cpw) return null;
  return pw === cpw ? null : { passwordsMismatch: true };
}
