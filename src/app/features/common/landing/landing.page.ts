import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { compassOutline, storefrontOutline } from 'ionicons/icons';

/**
 * Landing page di Trentino Quest.
 *
 * Pagina pubblica di ingresso visibile a utenti non autenticati.
 * Layout single-viewport: hero compatto + due card di scelta del
 * ruolo + link al login.
 *
 * Indirizza l'utente verso la registrazione del ruolo appropriato:
 * - Giocatore       -> /giocatore/register
 * - Attivita Locale -> /attivita/register
 *
 * Gli utenti gia registrati possono accedere via link al login.
 *
 * NOTA su RF1 D1: la spiegazione dettagliata delle funzionalita
 * dell'app non e' presente in questa landing per scelta UX (mantenere
 * il single-viewport). Verra' fornita post-registrazione, personalizzata
 * sul ruolo dell'utente. TODO: valutare in futuro l'aggiunta di un link
 * "Cos'e Trentino Quest?" verso una pagina /about dedicata se RF1
 * dovesse essere richiesto pubblicamente.
 *
 * NOTA tecnica: il constructor registra solo le icone Ionicons usate
 * nel template (richiesto da Ionic 7+ con standalone components).
 */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  standalone: true,
  imports: [
    RouterLink,
    IonContent,
    IonCard,
    IonCardContent,
    IonButton,
    IonIcon,
  ],
})
export class LandingPage {
  constructor() {
    addIcons({compassOutline,storefrontOutline});
  }
}