/* ============================================================================
 * Quest types — re-export da @trentino-quest/shared-types
 * ============================================================================
 * Tutti i tipi di dominio (Quest, AnyQuest, Collectible, Completion, ecc.)
 * vivono ora in shared-types come fonte di verita' unica condivisa tra
 * frontend e backend.
 *
 * Questo file fa due cose:
 * 1. Re-export dei tipi shared per consumo trasparente dai componenti.
 *    Es: import { AnyQuest } from '...quest.types'
 *    (invece di import { AnyQuest } from '@trentino-quest/shared-types')
 *    Mantiene un punto d'ingresso centralizzato che semplifica eventuali
 *    refactor futuri.
 * 2. Definisce PlayerQuestStatus, un tipo CLIENT-SIDE che non esiste
 *    nell'API: rappresenta come una quest appare al giocatore corrente,
 *    derivato confrontando la quest con i suoi Completion.
 * ========================================================================== */

// ============================================================================
// Re-export dei tipi shared
// ============================================================================

export {
  // Quest e tipi correlati
  Quest,
  PrimaryQuest,
  SecondaryQuest,
  AnyQuest,
  QuestType,
  QuestStatus,

  // Completion
  Completion,
  CompletionEntry,

  // DTO richieste/risposte
  CheckInRequest,
  CheckInResponse,
  ScanQrRequest,
  ScanQrResponse,

  // Progress
  ProgressSummary,

  // Collectibles
  Collectible,
  CollectibleEntry,
  CollectibleRarity,
  CollectibleStatus,

  // Placement QR
  PlacementStatus,
} from '@trentino-quest/shared-types';

// NOTA: GeoPoint e Links vivono in @trentino-quest/shared-types/common.
// Se la tua versione li espone dal barrel principale, scommenta:
// export { GeoPoint, Links } from '@trentino-quest/shared-types';

// ============================================================================
// Tipi e funzioni CLIENT-SIDE (non parte dell'API)
// ============================================================================

import { AnyQuest, Completion } from '@trentino-quest/shared-types';

/**
 * Stato di una quest dal punto di vista del giocatore corrente.
 *
 * NON esiste come campo nell'API: e' una vista derivata sul frontend
 * confrontando la lista delle quest con la lista dei Completion del
 * giocatore.
 *
 * Stati:
 * - discovered: il giocatore ha gia' completato questa quest (esiste
 *   un Completion con il suo questId).
 * - available: la quest e' attiva e non ancora completata.
 * - locked: la quest non e' ancora accessibile (es. prerequisiti).
 *   TODO: il backend non espone ancora un concetto di "locked".
 *   Per ora nessuna quest viene marcata locked. Quando il backend
 *   avra' regole di prerequisiti (es. "completa la zona X per
 *   sbloccare le quest della zona Y"), aggiornare derivePlayerStatus().
 */
export type PlayerQuestStatus = 'discovered' | 'available' | 'locked';

/**
 * Deriva lo stato di una quest dal punto di vista del giocatore.
 *
 * @param quest la quest da valutare
 * @param completions lista dei completion del giocatore corrente
 * @returns lo stato per la UI (colore marker, icona, ecc.)
 */
export function derivePlayerStatus(quest: AnyQuest, completions: Completion[]): PlayerQuestStatus {
  // Discovered: c'e' un completion con questo questId.
  const isCompleted = completions.some((c) => c.questId === quest.id);
  if (isCompleted) return 'discovered';

  // TODO: gestire 'locked' quando il backend espone prerequisiti.
  // Per ora tutte le quest non completate sono available.
  return 'available';
}
