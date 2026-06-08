/**
 * Setup globale per i test Vitest + Angular.
 *
 * Inizializza l'ambiente di test di Angular (TestBed) una sola volta per
 * l'intera sessione, esattamente come farebbe Karma con `src/test.ts`.
 */
import '@analogjs/vitest-angular/setup-zone';

import {
  fetch as undiciFetch,
  Headers as UndiciHeaders,
  Request as UndiciRequest,
  Response as UndiciResponse,
} from 'undici';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { getTestBed } from '@angular/core/testing';

/**
 * jsdom fornisce un `fetch` che applica le regole CORS del browser: una POST
 * con `Content-Type: application/json` richiede una preflight OPTIONS che,
 * in ambiente di test, fa fallire la richiesta (status 0). Sostituiamo il
 * fetch globale con quello nativo di Node (undici), che non applica CORS —
 * coerente con il comportamento reale dell'app su WebView/dispositivo, dove
 * le chiamate non sono soggette alla same-origin policy del test runner.
 */
const g = globalThis as unknown as Record<string, unknown>;
g['fetch'] = undiciFetch;
g['Headers'] = UndiciHeaders;
g['Request'] = UndiciRequest;
g['Response'] = UndiciResponse;

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
