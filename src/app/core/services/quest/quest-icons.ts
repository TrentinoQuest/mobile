import { AnyQuest, QuestType } from './quest.types';
import { PlayerQuestStatus } from './quest.types';

/**
 * Registry icone quest.
 *
 * Allineato al modello API ufficiale (AnyQuest = PrimaryQuest | SecondaryQuest):
 * - Primary quest: icona "scrigno" (rappresenta la ricompensa, sblocca un collectible)
 * - Secondary quest: icona "pin" (rappresenta un check-in geolocalizzato)
 * - Locked: icona lucchetto (sovrascrive in base allo stato giocatore)
 *
 * Per riavere le 5 categorie originali (monument/nature/culture/...),
 * il backend dovra' aggiungere un campo `category` o `tags` allo schema
 * Quest. Quando arrivera', sostituire questa logica con quella precedente.
 *
 * Pattern d'uso:
 *   const svg = getQuestIcon(quest, playerStatus);
 *   element.innerHTML = svg;
 *
 * Sicurezza: gli SVG sono dei nostri asset fidati, innerHTML e' sicuro.
 */

// ============================================================================
// SVG inline come stringhe
// ============================================================================
// fill="currentColor" -> colore controllato dal CSS della classe parent.
// viewBox 24x24 standard.

/**
 * Icona scrigno per le primary quest (sbloccano un collectible).
 * Visualmente piu' "ricca" perche' la ricompensa e' un oggetto raro.
 */
const PRIMARY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h14a2 2 0 012 2v3H3V6a2 2 0 012-2zm-2 7h18v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9zm9 2v3h2v-3h-2z"/></svg>`;

/**
 * Icona pin per le secondary quest (check-in geolocalizzato).
 * Pin classico da mappa, comunica "vai qui".
 */
const SECONDARY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;

/**
 * Icona lucchetto per quest locked.
 * TODO: il backend non espone ancora il concetto di locked, ma teniamo
 * l'asset pronto per quando arrivera'.
 */
const LOCKED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>`;

// ============================================================================
// API pubblica
// ============================================================================

/**
 * Restituisce la stringa SVG appropriata in base allo stato giocatore e
 * al tipo di quest.
 *
 * Priorita': locked > tipo quest.
 * Una quest locked mostra sempre il lucchetto, indipendentemente dal tipo.
 */
export function getQuestIcon(
  quest: AnyQuest,
  playerStatus: PlayerQuestStatus,
): string {
  if (playerStatus === 'locked') return LOCKED_SVG;
  return quest.type === QuestType.PRIMARY ? PRIMARY_SVG : SECONDARY_SVG;
}

/** Restituisce l'icona base di un tipo, senza considerare lo stato. */
export function getTypeIcon(type: QuestType): string {
  return type === QuestType.PRIMARY ? PRIMARY_SVG : SECONDARY_SVG;
}

/** Restituisce l'icona del lucchetto. Utile per legend / filtri. */
export function getLockedIcon(): string {
  return LOCKED_SVG;
}