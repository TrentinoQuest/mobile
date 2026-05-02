import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  isAuthenticated = signal(false);

  async login(email: string, password: string): Promise<boolean> {
    // Mock for now — replace with HTTP call later
    if (email && password.length >= 6) {
      this.isAuthenticated.set(true);
      return true;
    }
    return false;
  }

  logout() {
    this.isAuthenticated.set(false);
  }
}