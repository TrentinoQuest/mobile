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
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

import { AuthService } from './app/core/services/auth/auth.service';
import { ThemeService } from './app/core/services/theme/theme.service';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { refreshInterceptor } from './app/core/interceptors/refresh.interceptor';

import { QuestRepository } from './app/core/services/quest/repository/quest.repository';
import { HttpQuestRepository } from './app/core/services/quest/repository/quest.repository.http';

import { GeolocationRepository } from './app/core/services/geolocation/repository/geolocation.repository';
import { GeolocationRepositoryCapacitor } from './app/core/services/geolocation/repository/geolocation.repository.capacitor';

import { PlayerProfileRepository } from './app/core/services/player-profile/repository/player-profile.repository';
import { HttpPlayerProfileRepository } from './app/core/services/player-profile/repository/player-profile.repository.http';

import { BusinessRepository } from './app/core/services/business/repository/business.repository';
import { HttpBusinessRepository } from './app/core/services/business/repository/business.repository.http';

async function initializeTheme(): Promise<void> {
  const themeService = angularInject(ThemeService);
  await themeService.initialize();
}

/**
 * Setup della status bar nativa per il look immersivo edge-to-edge.
 *
 * - setOverlaysWebView(true): la WebView disegna SOTTO la status bar, cosi'
 *   la mappa va davvero a tutto schermo. Lo spazio in cima e' poi protetto
 *   nei layout via il token --tq-safe-top.
 * - Style.Light: icone/orologio chiari, leggibili sul nostro bg dark.
 *
 * Tutto guardato da isNativePlatform(): su web i metodi sarebbero no-op o
 * genererebbero warning inutili.
 */
async function initializeNativeUi(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    // Plugin non disponibile (es. web): ignora silenziosamente.
  }
}

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
    provideAppInitializer(initializeNativeUi),
    provideAppInitializer(initializeApp),

    { provide: QuestRepository, useClass: HttpQuestRepository },
    { provide: GeolocationRepository, useClass: GeolocationRepositoryCapacitor },
    { provide: PlayerProfileRepository, useClass: HttpPlayerProfileRepository },
    { provide: BusinessRepository, useClass: HttpBusinessRepository },
  ],
});
