import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.trentinoquest.mobile',
  appName: 'trentino-quest-mobile',
  webDir: 'www',
  server: {
    // In sviluppo la WebView gira su http per poter chiamare il backend
    // locale via http senza blocco mixed-content.
    // TODO: rimuovere prima del deploy prod (in prod il backend è https).
    androidScheme: 'http',
  },
};

export default config;
