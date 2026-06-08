/**
 * Helper condivisi per i test di integrazione contro il backend reale.
 *
 * Configura il TestBed con gli STESSI provider di `src/main.ts` (repository
 * HTTP reali, interceptor JWT), così i test esercitano il codice dell'app
 * nel modo più fedele possibile alla produzione. L'unica differenza:
 * HttpClient usa il backend fetch (Node) invece di XHR, e il Geolocation
 * service è sostituito da un fake controllabile.
 */
import { Provider, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { authInterceptor } from '../../src/app/core/interceptors/auth.interceptor';
import { refreshInterceptor } from '../../src/app/core/interceptors/refresh.interceptor';

import { QuestRepository } from '../../src/app/core/services/quest/repository/quest.repository';
import { HttpQuestRepository } from '../../src/app/core/services/quest/repository/quest.repository.http';
import { PlayerProfileRepository } from '../../src/app/core/services/player-profile/repository/player-profile.repository';
import { HttpPlayerProfileRepository } from '../../src/app/core/services/player-profile/repository/player-profile.repository.http';
import { BusinessRepository } from '../../src/app/core/services/business/repository/business.repository';
import { HttpBusinessRepository } from '../../src/app/core/services/business/repository/business.repository.http';
import { GeolocationService } from '../../src/app/core/services/geolocation/geolocation.service';

/**
 * Fake del GeolocationService: espone una `position()` controllabile, così i
 * test su check-in/scan possono decidere se inviare o meno il campo `fix`
 * anti-cheat senza dipendere dai plugin Capacitor nativi.
 */
export class FakeGeolocationService {
  readonly position = signal<{ accuracy: number; clientTimestamp: number } | null>(null);
  setFix(accuracy = 8): void {
    this.position.set({ accuracy, clientTimestamp: Date.now() });
  }
  clearFix(): void {
    this.position.set(null);
  }
}

/**
 * Configura il TestBed replicando i provider di produzione.
 * @param extra provider aggiuntivi/override specifici del singolo spec.
 */
export function setupTestBed(extra: Provider[] = []): void {
  // Permette di riconfigurare il TestBed più volte nello stesso test
  // (es. per simulare un login "da zero" dopo la registrazione).
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(
        withInterceptors([authInterceptor, refreshInterceptor]),
        withFetch(),
      ),
      { provide: QuestRepository, useClass: HttpQuestRepository },
      { provide: PlayerProfileRepository, useClass: HttpPlayerProfileRepository },
      { provide: BusinessRepository, useClass: HttpBusinessRepository },
      { provide: GeolocationService, useClass: FakeGeolocationService },
      ...extra,
    ],
  });
}

// ── Generatori di dati di test ──────────────────────────────────────────────
const RUN = Math.random().toString(36).slice(2, 7);
let seq = 0;

/** Credenziali player uniche per ogni invocazione. */
export function uniquePlayer(tag = 'p') {
  seq += 1;
  return {
    email: `qa.${tag}.${Date.now()}.${seq}.${RUN}@trentinoquest.test`,
    password: 'Password123!',
    username: `qa_${tag}_${seq}_${RUN}`.slice(0, 30),
  };
}

/**
 * Attende che una condizione (tipicamente la lettura di un signal) diventi
 * truthy. Utile per i metodi `load*()` dei service che sono `void` e
 * aggiornano lo stato in modo asincrono via subscribe interno.
 */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  { timeout = 30_000, interval = 100 } = {},
): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor: timeout in attesa della condizione');
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

// ── Scaffolding "raw" (solo per predisporre lo stato sul backend) ────────────
// Questi helper NON sono il codice sotto test: servono a portare il backend in
// uno stato di partenza (es. due player già amici) prima di esercitare i
// metodi reali del componente.
import { environment } from '../../src/environments/environment';

export interface RawResult<T = unknown> {
  status: number;
  data: T;
}

export async function api<T = unknown>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<RawResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${environment.apiUrl}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data: data as T };
}

/** Registra un player via API raw e restituisce token + user. */
export async function rawRegister(tag = 'raw') {
  const creds = uniquePlayer(tag);
  const { data } = await api<{ accessToken: string; refreshToken: string; user: any }>(
    'POST',
    '/auth/register',
    { body: creds },
  );
  return { creds, token: data.accessToken, user: data.user };
}

/** Crea un'amicizia accettata fra due player (scaffolding). */
export async function rawBefriend(
  a: { token: string; user: any },
  b: { token: string; creds: { username: string } },
): Promise<void> {
  await api('POST', '/social/friends/request', {
    token: a.token,
    body: { username: b.creds.username },
  });
  const reqs = await api<any[]>('GET', '/social/friends/requests', { token: b.token });
  const list = Array.isArray(reqs.data) ? reqs.data : (reqs.data as any)?.requests ?? [];
  const friendshipId = list[0]?.friendshipId ?? list[0]?.id;
  if (friendshipId) {
    await api('POST', `/social/friends/${friendshipId}/accept`, { token: b.token, body: {} });
  }
}

/** Esegue N check-in validi per accumulare punti (scaffolding economia). */
export async function rawEarnPoints(token: string, count: number): Promise<number> {
  const quests = await api<any[]>('GET', '/quests', { token });
  const secs = (quests.data as any[]).filter((q) => q.type === 'secondary' && q.position).slice(0, count);
  let ok = 0;
  for (const s of secs) {
    const r = await api('POST', `/quests/${s.id}/check-in`, {
      token,
      body: { position: s.position, fix: { accuracy: 8, clientTimestamp: Date.now() } },
    });
    if (r.status < 300) ok += 1;
  }
  return ok;
}

/** Pulisce lo storage Preferences (localStorage) tra un test e l'altro. */
export function clearAuthStorage(): void {
  try {
    localStorage.clear();
  } catch {
    /* jsdom senza localStorage: ignora */
  }
}
