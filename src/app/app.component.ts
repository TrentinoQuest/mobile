import { Component, effect, inject, Injector } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './core/services/auth/auth.service';
import { GeolocationService } from './core/services/geolocation/geolocation.service';

/**
 * Root component dell'app.
 *
 * Oltre al setup standard Ionic (IonApp + IonRouterOutlet), gestisce
 * il wiring cross-cutting tra autenticazione e geolocalizzazione:
 *
 *  - All'autenticazione (currentUser passa da null → user), istanzia
 *    e avvia il GeolocationService (bootstrap → check permission →
 *    eventualmente start watch).
 *  - Al logout (currentUser passa da user → null), ferma il watch
 *    GPS per non drenare batteria.
 *
 * Il GeolocationService viene istanziato LAZY (solo al primo login,
 * non al boot dell'app) usando Injector.get() dentro l'effect invece
 * di inject() nel constructor. Questo garantisce che:
 *  - Utente non autenticato (landing, login, register) non veda mai
 *    il prompt GPS del browser/OS
 *  - Utente autenticato ha il GPS pronto quando arriva sulla mappa
 */
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);

  /**
   * Riferimento al GeolocationService, popolato lazy alla prima
   * autenticazione. Resta valorizzato per tutta la vita dell'app
   * anche dopo logout: il service e' singleton, lo riusiamo per
   * eventuali login successivi.
   */
  private geolocationService: GeolocationService | null = null;

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();

      if (user) {
        // Login (o ripristino sessione da Preferences al boot).
        // Istanzia il service la prima volta, riusa l'istanza esistente
        // nei login successivi (resync del bootstrap dopo logout).
        this.geolocationService ??= this.injector.get(GeolocationService);
        void this.geolocationService.bootstrap();
      } else if (this.geolocationService) {
        // Logout. Se il service era stato istanziato, fermiamo il watch
        // per non sprecare batteria. Non lo distruggiamo: al prossimo
        // login lo riavviamo.
        void this.geolocationService.stopWatching();
      }
    });
  }
}
