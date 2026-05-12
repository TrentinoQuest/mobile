import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

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
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
})
export class HomePage {}
