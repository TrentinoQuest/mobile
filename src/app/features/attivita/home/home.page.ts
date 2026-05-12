import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

/**
 * Home dell'Attività Locale.
 *
 * STUB: pagina placeholder per l'Attività Locale autenticata.
 * Verra trasformata nella dashboard di gestione (offerte, statistiche,
 * validazione QR clienti) in una fase successiva.
 */
@Component({
  selector: 'app-attivita-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
})
export class AttivitaHomePage {}
