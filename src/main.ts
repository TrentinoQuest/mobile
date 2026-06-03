import { bootstrapApplication } from '@angular/platform-browser';
import { provideAppInitializer, inject as angularInject } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  RouteReuseStrategy,
  Router,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

import { AuthService } from './app/core/services/auth/auth.service';
import { ThemeService } from './app/core/services/theme/theme.service';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { refreshInterceptor } from './app/core/interceptors/refresh.interceptor';

import { QuestRepository } from './app/core/services/quest/repository/quest.repository';
import { MockQuestRepository } from './app/core/services/quest/repository/quest.repository.mock';
import { HttpQuestRepository } from './app/core/services/quest/repository/quest.repository.http';

import { GeolocationRepository } from './app/core/services/geolocation/repository/geolocation.repository';
import { GeolocationRepositoryCapacitor } from './app/core/services/geolocation/repository/geolocation.repository.capacitor';

import { PlayerProfileRepository } from './app/core/services/player-profile/repository/player-profile.repository';
import { MockPlayerProfileRepository } from './app/core/services/player-profile/repository/player-profile.repository.mock';
import { HttpPlayerProfileRepository } from './app/core/services/player-profile/repository/player-profile.repository.http';

import { BusinessRepository } from './app/core/services/business/repository/business.repository';
import { MockBusinessRepository } from './app/core/services/business/repository/business.repository.mock';
import { HttpBusinessRepository } from './app/core/services/business/repository/business.repository.http';

/**
 * Primo initializer: applica il tema salvato prima che qualsiasi
 * componente venga renderizzato, eliminando il flash of unstyled content.
 */
async function initializeTheme(): Promise<void> {
  const themeService = angularInject(ThemeService);
  await themeService.initialize();
}

/**
 * Funzione di inizializzazione dell'app.
 *
 * Eseguita da Angular prima di renderizzare qualunque componente.
 * Esegue in parallelo:
 * - Caricamento dei token salvati da Capacitor Preferences
 * - Verifica della raggiungibilita del backend via /health
 *
 * Se il backend non risponde, naviga alla pagina /offline prima
 * ancora che l'utente veda la landing.
 *
 * Eventuali errori inattesi vengono catturati silenziosamente: meglio
 * un'app che parte con stato non perfetto che un'app che non parte affatto.
 */
async function initializeApp(): Promise<void> {
  const authService = angularInject(AuthService);
  const router = angularInject(Router);

  try {
    const [, isBackendOnline] = await Promise.all([
      authService.loadFromStorage(),
      authService.checkBackendHealth(),
    ]);

    if (!environment.production) {
      const userLoaded = authService.currentUser() !== null;
      // eslint-disable-next-line no-console
      console.log('[AppInit] Stato utente:', userLoaded ? 'autenticato' : 'non autenticato');
      // eslint-disable-next-line no-console
      console.log('[AppInit] Backend:', isBackendOnline ? 'online' : 'offline');
    }

    if (!isBackendOnline) {
      await router.navigate(['/offline']);
    }
  } catch (error) {
    // Errore inatteso nell'initializer: lasciamo partire l'app comunque.
    if (!environment.production) {
      // eslint-disable-next-line no-console
      console.error('[AppInit] Errore durante inizializzazione:', error);
    }
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, refreshInterceptor])),
    provideAppInitializer(initializeTheme),
    provideAppInitializer(initializeApp),

    // ============================================================
    // Quest data layer
    // ============================================================
    // Binding del contratto QuestRepository alla sua implementazione concreta.
    // Per passare al backend reale: cambia MockQuestRepository in HttpQuestRepository.
    // QuestService riceve automaticamente l'implementazione corrente via DI.
    {
      provide: QuestRepository,
      useClass: environment.questRepository === 'http' ? HttpQuestRepository : MockQuestRepository,
    },

    // ============================================================
    // Geolocation data layer
    // ============================================================
    // Binding del contratto GeolocationRepository all'implementazione
    // Capacitor (funziona sia su native sia su browser desktop via
    // fallback W3C Geolocation). Nessun toggle environment: una
    // futura repository mock potra' essere aggiunta qui se servisse
    // per test o sviluppo offline.
    { provide: GeolocationRepository, useClass: GeolocationRepositoryCapacitor },

    // ============================================================
    // Player Profile data layer
    // ============================================================
    {
      provide: PlayerProfileRepository,
      useClass:
        environment.playerProfileRepository === 'http'
          ? HttpPlayerProfileRepository
          : MockPlayerProfileRepository,
    },

    // ============================================================
    // Business data layer
    // ============================================================
    {
      provide: BusinessRepository,
      useClass:
        environment.businessRepository === 'http'
          ? HttpBusinessRepository
          : MockBusinessRepository,
    },
  ],
});
