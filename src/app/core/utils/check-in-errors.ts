import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorCode } from './http-error';

/**
 * Mapping condiviso codice errore backend -> messaggio user-friendly per i
 * flussi di check-in (quest secondarie). Unica copia per sheet, popup e
 * pagina di dettaglio.
 */
export const CHECK_IN_ERROR_MESSAGES: Record<string, string> = {
  OUT_OF_CHECK_IN_RADIUS: "Sei troppo lontano. Avvicinati ancora un po'.",
  OUT_OF_RANGE: 'Sei fuori dal raggio. Avvicinati alla quest.',
  QUEST_ALREADY_COMPLETED: 'Hai già completato questa quest.',
  QUEST_INACTIVE: 'Questa quest non è attualmente disponibile.',
  OUT_OF_RANGE_ACCURACY: "GPS troppo impreciso. Spostati all'aperto e riprova.",
  STALE_FIX: 'Fix GPS scaduto. Attendi un aggiornamento della posizione.',
  GPS_REQUIRED: 'Posizione GPS obbligatoria per il check-in.',
};

/** Converte un errore HTTP di check-in in messaggio per l'utente. */
export function formatCheckInError(err: unknown): string {
  const code = extractErrorCode(err);
  if (code && CHECK_IN_ERROR_MESSAGES[code]) return CHECK_IN_ERROR_MESSAGES[code];
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Connessione assente. Verifica la rete.';
    if (err.status === 422) return 'Posizione non accettata dal server.';
  }
  return 'Errore durante il check-in. Riprova.';
}
