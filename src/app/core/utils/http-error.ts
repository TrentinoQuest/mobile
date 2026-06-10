import { HttpErrorResponse } from '@angular/common/http';

/**
 * Estrazione uniforme del codice errore applicativo dal body delle risposte
 * del backend.
 *
 * Il backend (e lo schema Error in docs/swagger.yaml) restituisce errori
 * con envelope TOP-LEVEL: `{ code, message, details? }`. In passato parti
 * del codice leggevano `err.error.error.code` (doppio annidamento) e non
 * matchavano mai i codici: questa utility e' l'unico punto di parsing.
 * Per difesa accettiamo anche l'eventuale forma annidata.
 */

interface ErrorBody {
  code?: string;
  message?: string;
  error?: { code?: string; message?: string };
}

/** Ritorna il codice errore applicativo (es. QUEST_ALREADY_COMPLETED) o null. */
export function extractErrorCode(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const body = err.error as ErrorBody | null;
  return body?.code ?? body?.error?.code ?? null;
}

/** Ritorna il messaggio del backend, o null se assente. */
export function extractErrorMessage(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const body = err.error as ErrorBody | null;
  return body?.message ?? body?.error?.message ?? null;
}
