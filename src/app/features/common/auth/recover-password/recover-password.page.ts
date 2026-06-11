import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IonContent, IonSpinner, ToastController } from '@ionic/angular/standalone';
import { PasswordRecoveryRequest } from '@trentino-quest/shared-types';
import { AuthService } from '../../../../core/services/auth/auth.service';

@Component({
  selector: 'app-recover-password',
  templateUrl: './recover-password.page.html',
  styleUrls: ['./recover-password.page.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IonContent, IonSpinner],
})
export class RecoverPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toastCtrl = inject(ToastController);

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly emailSent = signal('');

  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  goBack(): void {
    void this.router.navigate(['/auth/login']);
  }

  reset(): void {
    this.sent.set(false);
    this.emailSent.set('');
    this.form.reset();
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.submitting()) return;

    this.submitting.set(true);

    const request: PasswordRecoveryRequest = {
      email: this.form.value.email.trim(),
    };

    this.authService.recoverPassword(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.emailSent.set(request.email);
        this.sent.set(true);
      },
      error: () => {
        this.submitting.set(false);
        // Il backend risponde sempre con successo per non rivelare se l'email è registrata.
        // In caso di errore di rete, mostriamo un toast generico.
        void this.showErrorToast('Si è verificato un errore. Riprova più tardi.');
      },
    });
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
}
