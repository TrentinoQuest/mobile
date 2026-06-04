// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,

  /**
   * Base URL delle API REST di Trentino Quest.
   * In sviluppo locale punta al backend in esecuzione sul PC.
   * Cambia l'IP se la macchina cambia indirizzo sulla LAN.
   */
  apiUrl: 'https://backend-utj0.onrender.com/api/v1',

  /**
   * Endpoint di health check del backend.
   * Vive a livello di root del server, fuori dal namespace /api/v1.
   */
  healthCheckUrl: 'https://backend-utj0.onrender.com/health',
};

// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
