import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { RegisterPlayerRequest } from '@trentino-quest/shared-types';
import { AuthService } from '../../../core/services/auth/auth.service';

/**
 * RegisterPlayerPage — Registrazione di un nuovo Giocatore.
 *
 * Form con 4 campi: email, username, password, conferma password.
 * Al submit chiama AuthService.registerPlayer() che salva token e user
 * in Preferences. Su successo naviga a /giocatore/home.
 *
 * Gestione errori:
 * - 409 con code EMAIL_ALREADY_EXISTS: errore inline sotto email
 * - 409 con code USERNAME_ALREADY_TAKEN: errore inline sotto username
 * - 400 e altri: toast generico
 * - Network error: gestito globalmente da errorInterceptor (naviga a /offline)
 */
@Component({
  selector: 'app-register-player',
  templateUrl: './register-player.page.html',
  styleUrls: ['./register-player.page.scss'],
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
export class RegisterPlayerPage {
  // ===========================================================================
  // Costanti — codici errore del backend
  // ===========================================================================

  private static readonly ERROR_CODE_EMAIL_EXISTS = 'EMAIL_ALREADY_EXISTS';
  private static readonly ERROR_CODE_USERNAME_TAKEN = 'USERNAME_ALREADY_TAKEN';

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

  /** Toggle visibilita conferma password. */
  readonly confirmPasswordVisible = signal(false);

  /** Errore "email gia in uso" dal backend (mostrato inline). */
  readonly emailAlreadyExists = signal(false);

  /** Errore "username gia in uso" dal backend (mostrato inline). */
  readonly usernameAlreadyTaken = signal(false);

  // ===========================================================================
  // Form
  // ===========================================================================

  readonly form: FormGroup = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(30),
        ],
      ],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  constructor() {
    addIcons({ 'eye-outline': eyeOutline, 'eye-off-outline': eyeOffOutline });

    // Quando l'utente modifica un campo che aveva errore inline dal backend,
    // resettiamo l'errore: ha potenzialmente sistemato il problema.
    this.form.get('email')?.valueChanges.subscribe(() => {
      if (this.emailAlreadyExists()) this.emailAlreadyExists.set(false);
    });
    this.form.get('username')?.valueChanges.subscribe(() => {
      if (this.usernameAlreadyTaken()) this.usernameAlreadyTaken.set(false);
    });
  }

  // ===========================================================================
  // Azioni
  // ===========================================================================

  togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible.update((v) => !v);
  }

  /**
   * Submit del form. Valida, chiama il servizio, gestisce esito.
   */
  async submit(): Promise<void> {
    // Marca tutti i campi come touched per mostrare gli errori
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) {
      return;
    }

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
        // Token salvati automaticamente da AuthService
        void this.router.navigate(['/giocatore/home']);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        void this.handleRegistrationError(err);
      },
    });
  }

  // ===========================================================================
  // Gestione errori
  // ===========================================================================

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
      // 409 con codice non noto: toast generico
      await this.showErrorToast('Email o username gia in uso.');
      return;
    }

    if (err.status === 400) {
      await this.showErrorToast('Dati non validi. Controlla i campi.');
      return;
    }

    // Errore generico server o non gestito
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

  // ===========================================================================
  // Helper per template
  // ===========================================================================

  /** Espone i FormControl al template per accesso pulito. */
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

  /**
   * True se le password non coincidono e il campo confirmPassword e' stato
   * toccato. Usato per mostrare l'errore solo dopo che l'utente ha provato.
   */
  get passwordsMismatch(): boolean {
    return (
      this.form.errors?.['passwordsMismatch'] === true &&
      this.confirmPassword.touched
    );
  }
}

// =============================================================================
// Validatore custom: password e conferma devono coincidere
// =============================================================================

/**
 * Validatore di gruppo: aggiunge un errore `passwordsMismatch` al FormGroup
 * se i campi `password` e `confirmPassword` non coincidono.
 */
function passwordsMatchValidator(
  group: AbstractControl,
): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordsMismatch: true };
}