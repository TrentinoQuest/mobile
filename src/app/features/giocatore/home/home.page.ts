import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons } from '@ionic/angular/standalone';
import { LogoutButtonComponent } from 'src/app/shared/components/logout-button/logout-button.component';

/**
 * Home del Giocatore.
 *
 * STUB: pagina placeholder mostrata dopo registrazione/login del Giocatore.
 * Verra trasformata nella mappa interattiva delle quest in una fase
 * successiva del progetto.
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, LogoutButtonComponent],
})
export class HomePage {}
