export const environment = {
  production: true,

  /**
   * Base URL delle API REST in produzione.
   * Backend deployato su Render (stesso ambiente usato in sviluppo finche'
   * non esiste un dominio dedicato).
   */
  apiUrl: 'https://backend-utj0.onrender.com/api/v1',

  /**
   * Endpoint di health check in produzione.
   * Vive a livello di root del server, fuori dal namespace /api/v1.
   */
  healthCheckUrl: 'https://backend-utj0.onrender.com/health',
};
