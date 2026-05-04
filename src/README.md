# Trentino Quest — Mobile App

App mobile di **Trentino Quest**, app gamificata per l'esplorazione del Trentino.

Progetto del corso di **Ingegneria del Software** (a.a. 2025-2026), Università degli Studi di Trento, Prof. Sandro Fiore.
**Gruppo 19**: Valerio Cancemi (242804), Federico Caposano (243138).

## Stack tecnologico

- **Framework**: Ionic 8 + Angular 20 (standalone components)
- **Runtime nativo**: Capacitor 8 (Android, iOS)
- **Linguaggio**: TypeScript 5.x con strict mode
- **Build tool**: Angular CLI
- **Plugin nativi**:
  - `@capacitor/geolocation` per check-in geolocalizzati delle quest secondarie (RF17, RF18)
  - `@capacitor/barcode-scanner` per la scansione QR code delle quest principali (RF14)

## Architettura

L'app implementa il componente **MobileApp** del Deliverable D2, che espone tre porte distinte verso il backend:

- `pCommon` — funzionalità comuni a tutti i ruoli (autenticazione, onboarding)
- `pGiocatore` — esplorazione mappa, completamento quest, collezione, classifica
- `pAttivita` — gestione del profilo aziendale e validazione QR code dei giocatori

La struttura interna riflette questa organizzazione:

```
src/app/
├── app.component.{ts,html,scss}     # shell dell'applicazione
├── app.routes.ts                    # routing principale
├── core/                            # servizi e guard singleton (una sola istanza)
│   ├── guards/                      # auth guard, role guard
│   └── services/                    # auth service, api service
├── shared/                          # componenti puri riutilizzabili (vuoto, in arrivo)
└── features/                        # moduli funzionali lazy-loaded
    ├── common/                      # porta pCommon del MobileApp
    │   └── auth/
    │       └── login/               # pagina di login
    ├── giocatore/                   # porta pGiocatore (in arrivo)
    └── attivita/                    # porta pAttivita (in arrivo)
```

Le features verranno popolate progressivamente con le pagine corrispondenti ai casi d'uso del Deliverable D1 (UC-22 scansione QR, UC-30 check-in, UC-60 affiliazione attività, eccetera).

## Avvio rapido

Requisiti: Node.js >= 22, npm, Ionic CLI installata globalmente (`npm install -g @ionic/cli`).

### Sviluppo nel browser

```bash
# 1. Installa le dipendenze
npm install

# 2. Avvia l'app in modalità sviluppo nel browser
npm start
```

L'app sarà disponibile su `http://localhost:8100` con auto-reload sulle modifiche.

### Sviluppo su dispositivo o emulatore

Le piattaforme native (Android, iOS) verranno aggiunte in una fase successiva del progetto. Per ora il workflow di sviluppo principale è nel browser.

## Script disponibili

| Comando                | Descrizione                                  |
| ---------------------- | -------------------------------------------- |
| `npm start`            | Avvia l'app in modalità sviluppo nel browser |
| `npm run build`        | Compila l'app per produzione                 |
| `npm run watch`        | Build in watch mode per sviluppo             |
| `npm test`             | Esegue gli unit test con Karma               |
| `npm run lint`         | Esegue ESLint su tutti i file `.ts`          |
| `npm run lint:fix`     | ESLint con auto-fix                          |
| `npm run format`       | Formatta il codice con Prettier              |
| `npm run format:check` | Verifica la formattazione senza modificare   |
| `npm run typecheck`    | Verifica i tipi TypeScript senza compilare   |

## Comunicazione con il backend

L'app comunica con il backend tramite chiamate REST documentate nello schema OpenAPI del repository [`trentino-quest-backend`](https://github.com/TrentinoQuest/backend). I tipi TypeScript dei contratti API sono importati dal pacchetto condiviso [`@trentino-quest/shared-types`](https://github.com/TrentinoQuest/shared-types).

```typescript
import type { LoginRequest, AuthResponse, Player } from '@trentino-quest/shared-types';
```

Modificare un contratto API significa aggiornare i tipi nel pacchetto `shared-types`, pubblicarli, e reinstallare nel mobile-app con `npm install`. TypeScript segnalerà automaticamente eventuali punti del codice da adattare.

## Struttura del repository del progetto

Trentino Quest è organizzato come polyrepo:

- [`trentino-quest-docs`](https://github.com/TrentinoQuest/docs) — Deliverable D1, D2, ADR architetturali
- [`trentino-quest-backend`](https://github.com/TrentinoQuest/backend) — Backend Express + MongoDB
- [`trentino-quest-shared-types`](https://github.com/TrentinoQuest/shared-types) — DTO TypeScript condivisi
- **trentino-quest-mobile** — questo repository
- [`trentino-quest-backoffice`](https://github.com/TrentinoQuest/backoffice) — pannello amministrativo Angular

## Convenzioni di sviluppo

Il progetto segue **Conventional Commits**:

- `feat:` nuova funzionalità
- `fix:` correzione di bug
- `chore:` modifiche di setup, configurazione, manutenzione
- `docs:` aggiornamenti alla documentazione
- `refactor:` modifiche al codice senza cambi funzionali
- `test:` aggiunta o modifica di test
- `style:` modifiche di formattazione

ESLint e Prettier sono configurati con regole identiche al repository backend per garantire coerenza stilistica nei tre repository TypeScript.
