import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

/**
 * Landing page di Trentino Quest.
 *
 * Pagina pubblica di ingresso per utenti non autenticati. Layout immersivo
 * single-viewport, in chiave "gioco": brand forte, una riga che spiega cosa
 * fa l'app, due percorsi (esploratore / attivita locale) e link al login.
 *
 * Indirizza alla registrazione del ruolo:
 * - Esploratore     -> /giocatore/register
 * - Attivita Locale -> /attivita/register
 *
 * Markup volutamente senza ion-card/ion-button: usiamo elementi nativi con
 * routerLink per avere pieno controllo estetico col design system TQ.
 */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  standalone: true,
  imports: [RouterLink, IonContent],
})
export class LandingPage {}
