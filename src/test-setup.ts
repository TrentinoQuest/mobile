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

/**
 * Storage in-memory stabile al posto del localStorage di jsdom.
 *
 * Capacitor Preferences (web) legge `window.localStorage` a ogni chiamata;
 * i write fire-and-forget dell'app (es. persistenza token post-login) possono
 * completare DOPO che jsdom ha smontato l'ambiente del file di test, quando
 * `window.localStorage` non esiste piu' -> unhandled rejection
 * "Cannot read properties of undefined (reading 'setItem')".
 * Un oggetto nostro, definito su window e globalThis, resta valido per tutta
 * la sessione.
 */
const memStore = new Map<string, string>();
const memStorage: Storage = {
  get length() {
    return memStore.size;
  },
  clear: () => memStore.clear(),
  getItem: (key: string) => memStore.get(key) ?? null,
  key: (index: number) => [...memStore.keys()][index] ?? null,
  removeItem: (key: string) => void memStore.delete(key),
  setItem: (key: string, value: string) => void memStore.set(key, String(value)),
};
Object.defineProperty(globalThis, 'localStorage', { value: memStorage, configurable: true });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: memStorage, configurable: true });
}

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
