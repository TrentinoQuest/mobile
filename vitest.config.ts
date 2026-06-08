/// <reference types="vitest" />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';

/**
 * Configurazione Vitest per i test di integrazione contro il backend reale.
 *
 * Questi test esercitano l'IMPLEMENTAZIONE dei service/funzioni dell'app
 * (AuthService, QuestService, PlayerProfileService, BusinessService, e la
 * logica delle pagine) tramite il TestBed di Angular, con HttpClient reale
 * (backend Render). Non sostituiscono gli spec unitari Karma esistenti:
 * girano in una cartella separata (`tests/integration`).
 *
 * Eseguire con Node 24 (vedi `nvm use 24`).
 */
export default defineConfig(({ mode }) => ({
  plugins: [angular({ tsconfig: 'tsconfig.vitest.json' })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    // Solo i nostri spec di integrazione: evita di raccogliere gli *.spec.ts
    // Karma/Jasmine presenti in src/.
    include: ['tests/integration/**/*.spec.ts'],
    // Le chiamate reali al backend Render (cold start incluso) sono lente.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Le suite condividono stato sul backend (utenti, amicizie): niente
    // parallelismo aggressivo, eseguiamo in sequenza per risultati stabili.
    fileParallelism: false,
    pool: 'threads',
    // I pacchetti Ionic usano import di directory (ESM) che Vitest non
    // risolve come external: li inliniamo così Vite li trasforma.
    server: {
      deps: {
        inline: [/@ionic\/angular/, /@ionic\/core/, /ionicons/],
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^@ionic\/core\/components$/,
        replacement: '@ionic/core/components/index.js',
      },
    ],
  },
  define: {
    'import.meta.vitest': mode !== 'production',
  },
}));
