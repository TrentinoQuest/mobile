import { Component, inject } from '@angular/core';
import { ReactiveFormsModule , FormBuilder , Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonInput, IonButton, IonText,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    RouterLink,
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonInput, IonButton, IonText
  ],
})
export class LoginPage {
  email = '';
  password = '';

  private authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);

  loginForm = this.formBuilder.nonNullable.group(
    {
      email: ['' , Validators.required , Validators.minLength(1)],
      password: ['' , Validators.required , Validators.minLength(1)]
    }
  )

  submitting = false;
  errorMessage = '';

  async onLogin() {
    if (this.loginForm.invalid) return;

    this.submitting = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.getRawValue();
    const ok = await this.authService.login(email , password);

    this.submitting = true;

    if (ok){
      console.log('Login attempt:', this.email);
      this.router.navigateByUrl('/home')
    } else{
      this.submitting = false;
      this.errorMessage = 'Login fallito come te'
      console.log("Login Error!");
    }

  }
}
