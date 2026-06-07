import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TabBarComponent } from '../components/tab-bar/tab-bar.component';
import { PushNotificationService } from '../../../core/services/push-notification/push-notification.service';
/**
 * Layout shell della sezione Giocatore.
 *
 * Funzione:
 * Contenitore persistente per le 4 tab del giocatore (Home, Album, Amici,
 * Profilo). Monta una sola istanza della PlayerTabBarComponent in basso e
 * un <router-outlet> al centro dove Angular inietta la pagina della tab
 * attiva. Quando l'utente cambia tab, la tab bar non si rimonta — solo
 * l'outlet cambia componente.
 *
 * Perche' uno shell separato e non ion-tabs:
 * - ion-tabs di Ionic ha animazioni di transizione standard che non si
 *   adattano al nostro design (vogliamo cambio in place, non slide)
 * - serve un FAB centrale elevato (pulsante QR ocra) che ion-tabs non
 *   supporta nativamente come tab vera e propria
 * - il design e' mappa-centrica e immersivo: la home estende il rendering
 *   sotto la tab bar (effetto glass blur), che con ion-tabs e' un hack
 *
 * Layout CSS:
 * - .player-shell e' position: relative, fullscreen
 * - .player-shell__outlet contiene la pagina della tab attiva
 * - .player-shell__tab-bar e' position: fixed sul fondo (gestita dal
 *   componente figlio, qui ci limitiamo a montarla)
 *
 * Padding-bottom dell'outlet:
 * Volutamente NON applichiamo padding-bottom a livello di shell. Ogni
 * pagina figlia decide:
 * - Home (mappa): nessun padding, la mappa va edge-to-edge sotto la tab
 *   bar (effetto immersivo, tab bar in glass blur sopra)
 * - Album/Amici/Profilo: padding-bottom calc(64px + safe-area-inset) nel
 *   loro CSS interno per non finire sotto la tab bar
 *
 * Auth:
 * Il layout e' protetto da authGuard + role-check (PLAYER) nelle routes.
 * Tutte le pagine figlie ereditano questa protezione automaticamente.
 */
@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  standalone: true,
  imports: [RouterOutlet, TabBarComponent],
})
export class LayoutComponent implements OnInit {
  private readonly push = inject(PushNotificationService);

  ngOnInit(): void {
    void this.push.init();
  }
}
