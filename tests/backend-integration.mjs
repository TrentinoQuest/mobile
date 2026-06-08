/**
 * Backend integration test — Trentino Quest mobile.
 *
 * Esercita ogni endpoint REST usato (o usabile) dall'app mobile contro il
 * backend reale, registrando utenti di test veri. Non usa mock: serve a
 * capire COSA funziona davvero lato backend e cosa no.
 *
 * Uso:
 *   node tests/backend-integration.mjs
 *   API_URL=https://altro.host/api/v1 node tests/backend-integration.mjs
 *
 * Richiede Node 18+ (global fetch). In questo progetto: `nvm use 24`.
 *
 * Classificazione esito per ogni chiamata:
 *   PASS  — status atteso (di norma 2xx)
 *   EXPEC — errore atteso dato il contesto (es. 404 senza dati, 409 duplicato,
 *           422 anti-cheat su check-in a distanza). Non e' un bug.
 *   FAIL  — comportamento inatteso (5xx, errore di rete, status fuori contratto)
 */

const API_URL = process.env.API_URL ?? 'https://backend-utj0.onrender.com/api/v1';
const HEALTH_URL =
  process.env.HEALTH_URL ?? 'https://backend-utj0.onrender.com/health';

// ── Stato condiviso fra i test ────────────────────────────────────────────
const ctx = {
  a: { token: null, refresh: null, user: null, creds: null },
  b: { token: null, refresh: null, user: null, creds: null },
  questId: null,
  completionId: null,
  friendshipId: null,
  offerId: null,
};

const results = [];

// ── Helper HTTP ────────────────────────────────────────────────────────────
async function call(method, path, { token, body, query } = {}) {
  let url = path.startsWith('http') ? path : `${API_URL}${path}`;
  if (query) {
    const qs = new URLSearchParams(query).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const ms = Date.now() - started;
    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { ok: res.ok, status: res.status, data, ms };
  } catch (err) {
    return { ok: false, status: 0, data: String(err), ms: Date.now() - started };
  }
}

/**
 * Registra l'esito di un test.
 * @param expected array di status considerati corretti -> PASS
 * @param tolerated array di status considerati errori attesi -> EXPEC
 */
function record(module, name, res, expected, tolerated = []) {
  let verdict;
  if (expected.includes(res.status)) verdict = 'PASS';
  else if (tolerated.includes(res.status)) verdict = 'EXPEC';
  else verdict = 'FAIL';

  const note =
    verdict === 'PASS'
      ? ''
      : typeof res.data === 'object' && res.data
        ? res.data.code || res.data.message || JSON.stringify(res.data).slice(0, 120)
        : String(res.data ?? '').slice(0, 120);

  results.push({ module, name, verdict, status: res.status, ms: res.ms, note });
  const tag = { PASS: '✓', EXPEC: '~', FAIL: '✗' }[verdict];
  const line = `  ${tag} [${verdict}] ${name} → ${res.status} (${res.ms}ms)${note ? ' :: ' + note : ''}`;
  console.log(line);
  return res;
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

const rnd = Math.random().toString(36).slice(2, 8);
function makeCreds(tag) {
  return {
    email: `qa.${tag}.${Date.now()}.${rnd}@trentinoquest.test`,
    password: 'Password123!',
    username: `qa_${tag}_${rnd}`.slice(0, 30),
  };
}

// ── Test suite ───────────────────────────────────────────────────────────
async function run() {
  console.log(`Backend: ${API_URL}`);
  console.log(`Run id : ${rnd}\n`);

  // -- HEALTH ----------------------------------------------------------------
  section('Health');
  record('health', 'GET /health', await call('GET', HEALTH_URL), [200]);

  // -- AUTH ------------------------------------------------------------------
  section('Auth');
  ctx.a.creds = makeCreds('a');
  ctx.b.creds = makeCreds('b');

  let r = record(
    'auth',
    'POST /auth/register (player A)',
    await call('POST', '/auth/register', { body: ctx.a.creds }),
    [200, 201],
  );
  if (r.data?.accessToken) {
    ctx.a.token = r.data.accessToken;
    ctx.a.refresh = r.data.refreshToken;
    ctx.a.user = r.data.user;
  }

  r = record(
    'auth',
    'POST /auth/register (player B)',
    await call('POST', '/auth/register', { body: ctx.b.creds }),
    [200, 201],
  );
  if (r.data?.accessToken) {
    ctx.b.token = r.data.accessToken;
    ctx.b.refresh = r.data.refreshToken;
    ctx.b.user = r.data.user;
  }

  // duplicato -> 409 atteso
  record(
    'auth',
    'POST /auth/register (email duplicata)',
    await call('POST', '/auth/register', { body: ctx.a.creds }),
    [409],
    [400],
  );

  // login con le credenziali appena create
  r = record(
    'auth',
    'POST /auth/login',
    await call('POST', '/auth/login', {
      body: { email: ctx.a.creds.email, password: ctx.a.creds.password },
    }),
    [200],
  );
  if (r.data?.accessToken) ctx.a.token = r.data.accessToken;

  // credenziali errate -> 401 atteso
  record(
    'auth',
    'POST /auth/login (password errata)',
    await call('POST', '/auth/login', {
      body: { email: ctx.a.creds.email, password: 'sbagliata!!' },
    }),
    [401],
    [400],
  );

  // refresh
  r = record(
    'auth',
    'POST /auth/refresh',
    await call('POST', '/auth/refresh', { body: { refreshToken: ctx.a.refresh } }),
    [200],
  );
  if (r.data?.accessToken) ctx.a.token = r.data.accessToken;

  record(
    'auth',
    'POST /auth/password-recovery',
    await call('POST', '/auth/password-recovery', { body: { email: ctx.a.creds.email } }),
    [200, 202, 204],
  );

  record(
    'auth',
    'POST /auth/device-token',
    await call('POST', '/auth/device-token', {
      token: ctx.a.token,
      body: { fcmToken: `fake-fcm-token-${rnd}` }, // swagger: campo richiesto = fcmToken
    }),
    [200, 201, 204],
  );

  if (!ctx.a.token) {
    console.log('\n⚠️  Nessun token per player A: registrazione fallita. Stop.');
    return report();
  }

  const A = { token: ctx.a.token };
  const B = { token: ctx.b.token };

  // -- PLAYER PROFILE --------------------------------------------------------
  section('Player profile');
  r = record('player', 'GET /player/me', await call('GET', '/player/me', A), [200]);
  if (r.data) {
    console.log(
      `      coins=${r.data.coins ?? '∅'} points=${r.data.totalPoints ?? r.data.points ?? '∅'} xp=${r.data.xp ?? '∅'}`,
    );
  }
  record('player', 'GET /player/completions', await call('GET', '/player/completions', A), [200]);
  record('player', 'GET /player/collection', await call('GET', '/player/collection', A), [200]);
  // swagger: il param e' `zone` (opzionale), non `context`. Senza zone = totale regione.
  record('player', 'GET /player/progress', await call('GET', '/player/progress', A), [200]);
  record('player', 'GET /player/valley-progress', await call('GET', '/player/valley-progress', A), [200]);

  // -- QUESTS ----------------------------------------------------------------
  section('Quests');
  r = record('quest', 'GET /quests', await call('GET', '/quests', A), [200]);
  const quests = Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.quests ?? [];
  if (quests.length) {
    ctx.questId = quests[0].id;
    console.log(`      ${quests.length} quest disponibili, uso id=${ctx.questId}`);
  } else {
    console.log('      ⚠️  Nessuna quest restituita: i test dipendenti useranno un id fittizio.');
  }
  const qid = ctx.questId ?? 'non-existent-quest-id';

  record('quest', 'GET /quests/{id}', await call('GET', `/quests/${qid}`, A), [200], [404]);
  record(
    'quest',
    'GET /quests/{id}/proximity',
    await call('GET', `/quests/${qid}/proximity`, {
      ...A,
      query: { lat: '46.07', lng: '11.12' },
    }),
    [200],
    [400, 404],
  );

  // check-in lontano dal target: 422/403 anti-cheat atteso, 200 se la quest e' li'
  record(
    'quest',
    'POST /quests/{id}/check-in (lontano)',
    await call('POST', `/quests/${qid}/check-in`, {
      ...A,
      body: {
        position: { lat: 46.07, lng: 11.12 },
        fix: { accuracy: 10, clientTimestamp: Date.now() },
      },
    }),
    [200, 201],
    [400, 403, 404, 409, 422],
  );

  record(
    'quest',
    'POST /quests/{id}/scan (token finto)',
    await call('POST', `/quests/${qid}/scan`, {
      ...A,
      body: {
        qrToken: 'fake-qr-token',
        position: { lat: 46.07, lng: 11.12 },
        fix: { accuracy: 10, clientTimestamp: Date.now() },
      },
    }),
    [200, 201],
    [400, 403, 404, 409, 422],
  );

  // -- DAILY QUESTS ----------------------------------------------------------
  section('Daily quests');
  r = record(
    'daily',
    'GET /player/daily-quests',
    await call('GET', '/player/daily-quests', { ...A, query: { context: 'in_trentino' } }),
    [200],
  );
  const dqType = r.data?.quests?.[0]?.type ?? r.data?.[0]?.type ?? 'send_kudos';
  record(
    'daily',
    `POST /player/daily-quests/${dqType}/complete`,
    await call('POST', `/player/daily-quests/${dqType}/complete`, { ...A, body: {} }),
    [200, 201],
    [404, 409],
  );

  // -- LORE QUIZ -------------------------------------------------------------
  section('Lore quiz');
  record('lore', 'GET /lore/daily-question', await call('GET', '/lore/daily-question', A), [200], [404]);
  record(
    'lore',
    'POST /lore/answer',
    await call('POST', '/lore/answer', { ...A, body: { optionIndex: 0 } }),
    [200, 201],
    [404, 409],
  );

  // -- LEAGUES ---------------------------------------------------------------
  section('Leagues');
  record('leagues', 'GET /leagues/current', await call('GET', '/leagues/current', A), [200], [404]);
  record('leagues', 'GET /leagues/history', await call('GET', '/leagues/history', A), [200]);

  // -- SOCIAL ----------------------------------------------------------------
  section('Social');
  record('social', 'GET /social/feed', await call('GET', '/social/feed', { ...A, query: { limit: '20', offset: '0' } }), [200]);
  record('social', 'GET /social/leaderboard', await call('GET', '/social/leaderboard', A), [200], [404]);
  record('social', 'GET /social/friends', await call('GET', '/social/friends', A), [200]);
  record('social', 'GET /social/friends/requests', await call('GET', '/social/friends/requests', A), [200]);

  // A invia richiesta amicizia a B (per username, come da swagger)
  record(
    'social',
    'POST /social/friends/request (A→B by username)',
    await call('POST', '/social/friends/request', {
      ...A,
      body: { username: ctx.b.creds.username },
    }),
    [200, 201],
    [400, 404, 409],
  );

  // B legge le richieste ricevute e prova ad accettare
  r = await call('GET', '/social/friends/requests', B);
  record('social', 'GET /social/friends/requests (B)', r, [200]);
  const reqList = Array.isArray(r.data) ? r.data : r.data?.requests ?? r.data?.items ?? [];
  ctx.friendshipId = reqList[0]?.friendshipId ?? reqList[0]?.id ?? null;
  const fid = ctx.friendshipId ?? 'non-existent-friendship-id';

  record(
    'social',
    'POST /social/friends/{id}/accept (B)',
    await call('POST', `/social/friends/${fid}/accept`, { ...B, body: {} }),
    [200, 201],
    [400, 404, 409],
  );

  // kudos: serve una activity reale; senza completamenti reali ci aspettiamo 400/404
  record(
    'social',
    'POST /social/kudos',
    await call('POST', '/social/kudos', {
      ...A,
      body: {
        toPlayerId: ctx.b.user?.id ?? ctx.b.user?.playerId ?? 'unknown',
        activityType: 'quest_completion',
        activityId: ctx.completionId ?? 'unknown-activity',
        emoji: 'beer',
      },
    }),
    [200, 201],
    [400, 404, 409],
  );

  // -- COOP ------------------------------------------------------------------
  section('Coop');
  record('coop', 'GET /coop/challenges', await call('GET', '/coop/challenges', A), [200]);
  r = record(
    'coop',
    'POST /coop/challenges (A+B)',
    await call('POST', '/coop/challenges', {
      ...A,
      body: { partnerId: ctx.b.user?.id ?? ctx.b.user?.playerId ?? 'unknown', type: 'walk_50km' },
    }),
    [200, 201],
    [400, 403, 404],
  );
  const coopId = r.data?.id ?? null;
  if (coopId) {
    record('coop', 'GET /coop/challenges/{id}', await call('GET', `/coop/challenges/${coopId}`, A), [200], [404]);
    record(
      'coop',
      'POST /coop/challenges/{id}/progress',
      await call('POST', `/coop/challenges/${coopId}/progress`, { ...A, body: { value: 1 } }),
      [200, 201],
      [400, 404],
    );
  }
  record(
    'coop',
    'POST /coop/nudge/{partnerId}',
    await call('POST', `/coop/nudge/${ctx.b.user?.id ?? 'unknown'}`, { ...A, body: {} }),
    [200, 201, 204],
    [400, 403, 404, 409],
  );

  // -- MARKET ----------------------------------------------------------------
  section('Market');
  r = record('market', 'GET /market/offers', await call('GET', '/market/offers', A), [200]);
  const offers = Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.offers ?? [];
  ctx.offerId = offers[0]?.id ?? null;
  const oid = ctx.offerId ?? 'non-existent-offer-id';
  record(
    'market',
    'POST /market/purchase/{offerId}',
    await call('POST', `/market/purchase/${oid}`, { ...A, body: {} }),
    [200, 201],
    [400, 404, 409], // INSUFFICIENT_COINS / OFFER_SOLD_OUT / not found tutti attesi
  );
  record('market', 'GET /market/my-coupons', await call('GET', '/market/my-coupons', A), [200]);

  // -- ONBOARDING ------------------------------------------------------------
  section('Onboarding');
  record(
    'onboarding',
    'POST /onboarding/complete',
    await call('POST', '/onboarding/complete', { ...A, body: { playerClass: 'castle_hunter' } }),
    [200, 201],
    [400, 404, 409],
  );

  // -- AUTH cleanup ----------------------------------------------------------
  section('Auth logout');
  record(
    'auth',
    'POST /auth/logout',
    await call('POST', '/auth/logout', { ...A, body: { refreshToken: ctx.a.refresh } }),
    [200, 204],
  );

  report();
}

// ── Report finale ──────────────────────────────────────────────────────────
function report() {
  console.log('\n\n========== RIEPILOGO ==========');
  const byModule = {};
  for (const r of results) {
    (byModule[r.module] ??= []).push(r);
  }
  for (const [mod, rows] of Object.entries(byModule)) {
    const p = rows.filter((x) => x.verdict === 'PASS').length;
    const e = rows.filter((x) => x.verdict === 'EXPEC').length;
    const f = rows.filter((x) => x.verdict === 'FAIL').length;
    console.log(`\n${mod.toUpperCase()}  —  ✓${p}  ~${e}  ✗${f}`);
    for (const x of rows) {
      if (x.verdict !== 'PASS') {
        console.log(`   ${x.verdict === 'FAIL' ? '✗' : '~'} ${x.name} → ${x.status} ${x.note}`);
      }
    }
  }

  const fails = results.filter((x) => x.verdict === 'FAIL');
  console.log('\n================================');
  console.log(
    `Totale: ${results.length} chiamate — ` +
      `✓ ${results.filter((x) => x.verdict === 'PASS').length} PASS, ` +
      `~ ${results.filter((x) => x.verdict === 'EXPEC').length} attesi, ` +
      `✗ ${fails.length} FAIL`,
  );
  if (fails.length) {
    console.log('\n⚠️  PROBLEMI DA INVESTIGARE (potenziali bug backend o contratto):');
    for (const x of fails) {
      console.log(`   - [${x.module}] ${x.name} → status ${x.status} ${x.note}`);
    }
  } else {
    console.log('\n✅ Nessun FAIL: tutti gli endpoint rispondono entro il contratto atteso.');
  }
}

run().catch((e) => {
  console.error('Errore fatale nello script:', e);
  process.exit(1);
});
