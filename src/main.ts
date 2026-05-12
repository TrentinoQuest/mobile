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
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';
import { refreshInterceptor } from './app/core/interceptors/refresh.interceptor';

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
    provideAppInitializer(initializeApp),
  ],
});
