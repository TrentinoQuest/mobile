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
import { arrowBackOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { RegisterPlayerRequest } from '@trentino-quest/shared-types';
import { AuthService } from '../../../core/services/auth/auth.service';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'app-register-player',
  templateUrl: './register-player.page.html',
  styleUrls: ['./register-player.page.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonContent, IonIcon, IonSpinner],
})
export class RegisterPlayerPage {
  private static readonly ERROR_CODE_EMAIL_EXISTS = 'EMAIL_ALREADY_EXISTS';
  private static readonly ERROR_CODE_USERNAME_TAKEN = 'USERNAME_ALREADY_TAKEN';

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
  readonly usernameAlreadyTaken = signal(false);
  readonly shakeForm = signal(false);

  readonly form: FormGroup = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  constructor() {
    addIcons({ arrowBackOutline, eyeOutline, eyeOffOutline });
    this.form.get('email')?.valueChanges.subscribe(() => {
      if (this.emailAlreadyExists()) this.emailAlreadyExists.set(false);
    });
    this.form.get('username')?.valueChanges.subscribe(() => {
      if (this.usernameAlreadyTaken()) this.usernameAlreadyTaken.set(false);
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

  async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      if (this.form.invalid) void this.haptics.error();
      return;
    }

    void this.haptics.tapHeavy();
    this.audio.playTap();
    this.submitting.set(true);
    this.emailAlreadyExists.set(false);
    this.usernameAlreadyTaken.set(false);

    const request: RegisterPlayerRequest = {
      email: this.form.value.email.trim(),
      username: this.form.value.username.trim(),
      password: this.form.value.password,
    };

    this.authService.registerPlayer(request).subscribe({
      next: () => {
        void this.haptics.success();
        this.audio.playSuccess();
        void this.router.navigate(['/giocatore/home']);
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
      if (code === RegisterPlayerPage.ERROR_CODE_EMAIL_EXISTS) {
        this.emailAlreadyExists.set(true);
        return;
      }
      if (code === RegisterPlayerPage.ERROR_CODE_USERNAME_TAKEN) {
        this.usernameAlreadyTaken.set(true);
        return;
      }
      await this.showErrorToast('Email o username già in uso.');
      return;
    }

    void this.haptics.error();
    this.audio.playError();
    this.shakeForm.set(true);
    setTimeout(() => this.shakeForm.set(false), 400);

    if (err.status === 400) {
      await this.showErrorToast('Dati non validi. Controlla i campi.');
      return;
    }
    await this.showErrorToast('Si è verificato un errore. Riprova più tardi.');
  }

  private async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3500,
      position: 'bottom',
      color: 'danger',
    });
    await toast.present();
  }

  get email(): AbstractControl {
    return this.form.get('email')!;
  }
  get username(): AbstractControl {
    return this.form.get('username')!;
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
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  if (!password || !confirmPassword) return null;
  return password === confirmPassword ? null : { passwordsMismatch: true };
}
