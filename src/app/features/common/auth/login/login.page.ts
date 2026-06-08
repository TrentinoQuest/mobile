import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { LoginRequest, UserRole } from '@trentino-quest/shared-types';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { HapticsService } from '../../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../../core/services/audio.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonContent, IonIcon, IonSpinner],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);
  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);

  readonly submitting = signal(false);
  readonly passwordVisible = signal(false);
  readonly shakeForm = signal(false);

  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    addIcons({ arrowBackOutline, eyeOutline, eyeOffOutline });
  }

  goBack(): void {
    void this.router.navigate(['/']);
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
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

    const request: LoginRequest = {
      email: this.form.value.email.trim(),
      password: this.form.value.password,
    };

    this.authService.login(request).subscribe({
      next: (response) => {
        void this.handleLoginSuccess(response.user.role);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        void this.handleLoginError(err);
      },
    });
  }

  private async handleLoginSuccess(role: UserRole): Promise<void> {
    void this.haptics.success();
    this.audio.playSuccess();
    switch (role) {
      case UserRole.PLAYER:
        await this.router.navigate(['/giocatore/home']);
        break;
      case UserRole.BUSINESS:
        await this.router.navigate(['/attivita/home']);
        break;
      case UserRole.ADMIN:
        this.authService.logout();
        await this.showInfoToast('Account amministratore. Usa il backoffice web.');
        break;
      case UserRole.MAINTENANCE:
        this.authService.logout();
        await this.showInfoToast("Account operatore. Usa l'app dedicata.");
        break;
      default:
        this.authService.logout();
        await this.showErrorToast('Tipo di account non supportato.');
    }
  }

  private async handleLoginError(err: HttpErrorResponse): Promise<void> {
    void this.haptics.error();
    this.audio.playError();
    this.shakeForm.set(true);
    setTimeout(() => this.shakeForm.set(false), 400);

    if (err.status === 401) {
      await this.showErrorToast('Email o password errati.');
      return;
    }
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

  private async showInfoToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      position: 'bottom',
      color: 'medium',
    });
    await toast.present();
  }

  get email(): AbstractControl {
    return this.form.get('email')!;
  }

  get password(): AbstractControl {
    return this.form.get('password')!;
  }
}
