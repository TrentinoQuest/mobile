// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,

  /**
   * Base URL delle API REST di Trentino Quest.
   * Tutti gli endpoint del backend sono sotto /api/v1 come da OpenAPI.
   */
  apiUrl: 'http://localhost:3000/api/v1',

  /**
   * Endpoint di health check del backend.
   * Vive a livello di root del server, fuori dal namespace /api/v1.
   * Usato da AuthService all'avvio dell'app per verificare la
   * raggiungibilita del backend (Decisione bonus livello 3).
   */
  healthCheckUrl: 'http://localhost:3000/health',

  /**
   * Quale implementazione di QuestRepository iniettare.
   * 'mock' = dati hardcoded in memoria (sviluppo offline)
   * 'http' = chiamate REST al backend (richiede backend running)
   *
   * In dev manteniamo 'mock' di default finche' il backend quest non
   * e' implementato. Per testare l'integrazione, cambia a 'http' e
   * verifica che il backend risponda.
   */
  questRepository: 'http' as 'mock' | 'http',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
