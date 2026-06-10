# Trentino Quest — Build dell'app Android

Istruzioni per compilare l'APK a partire da questo repository.
Il progetto è un'app Ionic/Angular incapsulata con Capacitor.

## Prerequisiti

| Strumento      | Versione richiesta                                  |
| -------------- | --------------------------------------------------- |
| Node.js        | 20 o superiore (testato con la 24)                  |
| npm            | incluso in Node                                     |
| Android Studio | recente, con Android SDK (API 35) installato        |
| JDK            | 17 o superiore (incluso in Android Studio)          |

## 1. File con i dati sensibili (consegnato separatamente)

Il file `google-services.json` contiene l'API key Firebase e **non è
incluso nel repository**: viene consegnato separatamente insieme a
queste istruzioni.

Copiare il file ricevuto in:

```text
android/app/google-services.json
```

> Nota: senza questo file l'app **si compila comunque** (il plugin Google
> Services viene applicato solo se il file esiste), ma le notifiche push
> non funzioneranno.

## 2. Installare le dipendenze e compilare il frontend

Dalla radice del repository:

```bash
npm install
npm run build
npx cap sync android
```

- `npm run build` produce il bundle web in `www/`
- `npx cap sync android` copia il bundle dentro il progetto Android e
  rigenera i file di configurazione nativi (cartelle come
  `android/capacitor-cordova-android-plugins/` e
  `android/app/src/main/assets/public/` non sono nel repo: le crea
  questo comando)

## 3. Compilare l'APK

### Opzione A — Android Studio (consigliata)

1. Aprire Android Studio → **Open** → selezionare la cartella `android/`
2. Attendere la sincronizzazione di Gradle (alla prima apertura scarica
   le dipendenze, può richiedere qualche minuto)
3. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**
4. L'APK di debug si trova in
   `android/app/build/outputs/apk/debug/app-debug.apk`

Per provare l'app: collegare un telefono Android con il debug USB attivo
(o avviare un emulatore) e premere **Run ▶**.

### Opzione B — riga di comando

```bash
cd android
./gradlew assembleDebug
```

L'APK viene generato in `android/app/build/outputs/apk/debug/`.

> Il file `android/local.properties` (percorso dell'SDK sulla propria
> macchina) non è nel repo: Android Studio lo crea da solo alla prima
> apertura. Usando solo la riga di comando, crearlo a mano con una riga:
> `sdk.dir=/percorso/di/Android/Sdk`

## 4. Installare l'APK sul telefono

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

oppure copiare l'APK sul telefono e aprirlo (serve consentire
l'installazione da origini sconosciute).

## Problemi comuni

- **"SDK location not found"** → manca `android/local.properties`:
  aprire la cartella `android/` con Android Studio una volta, oppure
  creare il file a mano (vedi sopra).
- **Errore su `google-services.json`** → verificare che il file reale
  (non l'`.example`) sia in `android/app/` e si chiami esattamente
  `google-services.json`.
- **`www/` mancante o app bianca** → eseguire di nuovo
  `npm run build && npx cap sync android` prima di compilare.
- **L'app si avvia ma non carica i dati** → l'app parla col backend
  deployato (URL in `src/environments/environment.prod.ts`): serve una
  connessione a internet sul dispositivo.

## Build iOS

Anche la cartella `ios/` è versionata. Come per Android, il file con i dati
sensibili — `GoogleService-Info.plist` (API key Firebase) — **non è incluso
nel repository**: viene consegnato separatamente, insieme alle istruzioni
dettagliate di build per iOS, e va copiato in `ios/App/App/`.

Il flusso è analogo a quello Android (`npm install && npm run build &&
npx cap sync ios`), ma la compilazione finale avviene con **Xcode su
macOS**. Vedi le istruzioni allegate al file consegnato separatamente.
