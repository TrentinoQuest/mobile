import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOffOutline, eyeOutline } from 'ionicons/icons';
import { LoginRequest, UserRole } from '@trentino-quest/shared-types';
import { AuthService } from '../../../../core/services/auth/auth.service';

/**
 * LoginPage — Autenticazione di un utente esistente.
 *
 * Form con 2 campi: email e password.
 * Al submit chiama AuthService.login() che salva token e user in
 * Preferences. Dopo successo, naviga alla home appropriata in base
 * al ruolo dell'utente.
 *
 * Redirect by-role:
 * - player    -> /giocatore/home
 * - business  -> /attivita/home
 * - admin     -> toast + logout (admin usa il backoffice web)
 * - maintenance -> toast + logout (operatori hanno app dedicata)
 *
 * Gestione errori:
 * - 401 (credenziali errate): toast generico (no info-leak)
 * - 400 (input malformato): toast generico
 * - 5xx e altri: toast generico
 * - Network error: gestito da errorInterceptor (naviga a /offline)
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonItem,
    IonLabel,
    IonInput,
    IonNote,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
})
export class LoginPage {
  // ===========================================================================
  // Dependencies
  // ===========================================================================

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);

  // ===========================================================================
  // Stato
  // ===========================================================================

  /** True durante il submit, blocca il bottone. */
  readonly submitting = signal(false);

  /** Toggle visibilita password. */
  readonly passwordVisible = signal(false);

  // ===========================================================================
  // Form
  // ===========================================================================

  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  constructor() {
    addIcons({ 'eye-outline': eyeOutline, 'eye-off-outline': eyeOffOutline });
  }

  // ===========================================================================
  // Azioni
  // ===========================================================================

  togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }

  /**
   * Submit del form. Valida, chiama il servizio, gestisce esito.
   */
  async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);

    const request: LoginRequest = {
      email: this.form.value.email.trim(),
      password: this.form.value.password,
    };

    this.authService.login(request).subscribe({
      next: (response) => {
        // Token salvati automaticamente da AuthService
        void this.handleLoginSuccess(response.user.role);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        void this.handleLoginError(err);
      },
    });
  }

  // ===========================================================================
  // Gestione successo
  // ===========================================================================

  /**
   * Naviga alla home appropriata in base al ruolo dell'utente.
   * Per i ruoli non supportati dall'app mobile (admin, maintenance),
   * mostra un toast e fa logout.
   */
  private async handleLoginSuccess(role: UserRole): Promise<void> {
    switch (role) {
      case UserRole.PLAYER:
        await this.router.navigate(['/giocatore/home']);
        break;

      case UserRole.BUSINESS:
        await this.router.navigate(['/attivita/home']);
        break;

      case UserRole.ADMIN:
        this.authService.logout();
        await this.showInfoToast(
          'Account amministratore. Usa il backoffice web.',
        );
        break;

      case UserRole.MAINTENANCE:
        this.authService.logout();
        await this.showInfoToast(
          'Account operatore. Usa l\'app dedicata.',
        );
        break;

      default:
        // Ruolo sconosciuto, fallback prudente
        this.authService.logout();
        await this.showErrorToast(
          'Tipo di account non supportato.',
        );
    }
  }

  // ===========================================================================
  // Gestione errori
  // ===========================================================================

  private async handleLoginError(err: HttpErrorResponse): Promise<void> {
    if (err.status === 401) {
      await this.showErrorToast('Email o password errati.');
      return;
    }

    if (err.status === 400) {
      await this.showErrorToast('Dati non validi. Controlla i campi.');
      return;
    }

    await this.showErrorToast('Si e verificato un errore. Riprova piu tardi.');
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

  // ===========================================================================
  // Helper per template
  // ===========================================================================

  get email(): AbstractControl {
    return this.form.get('email')!;
  }

  get password(): AbstractControl {
    return this.form.get('password')!;
  }
}