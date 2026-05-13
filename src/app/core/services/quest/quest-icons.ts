import { QuestCategory, QuestStatus } from './quest.types';

/**
 * Registry icone quest.
 *
 * Centralizza la mappatura categoria/stato -> SVG inline.
 *
 * Le stringhe SVG sono hardcoded qui perche' Angular CLI con esbuild
 * non supporta nativamente la query "?raw" per importare file come stringhe
 * (e' una feature Vite-only). Le SVG sorgente vivono in:
 *
 *   src/assets/icons/quest/
 *     ├── monument.svg
 *     ├── nature.svg
 *     ├── culture.svg
 *     ├── tradition.svg
 *     ├── food.svg
 *     └── locked.svg
 *
 * Sono pensate come reference per il designer: aprendole in
 * Figma/Illustrator si vede l'attuale icona, sostituendole con
 * varianti migliori l'override va riportato QUI come stringa.
 *
 * MIGRAZIONE FUTURA:
 * Se in futuro si passa a un bundler che supporta "?raw" (Vite tramite
 * @angular-builders/vite, o uno script di build custom), si potra'
 * sostituire le costanti hardcoded con `import 'file.svg?raw'` e
 * tenere solo i file SVG come unica fonte di verita'.
 *
 * Pattern d'uso:
 *   const svg = getQuestIcon(quest);
 *   element.innerHTML = svg;
 *
 * Sicurezza: gli SVG sono dei nostri asset fidati, quindi possiamo
 * iniettarli via innerHTML senza sanitization. NON usare questo pattern
 * con SVG di provenienza esterna (es. user upload).
 */

// ============================================================================
// SVG inline come stringhe
// ============================================================================
// fill="currentColor" -> colore controllato dal CSS della classe parent.
// viewBox 24x24 standard. Dimensione finale (es. 18px) impostata nel CSS.

const MONUMENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 9v2h2v9h4v-6h2v6h4v-6h2v6h4v-9h2V9L12 2z"/></svg>`;

const NATURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 14h5v6h6v-6h5L12 2z"/></svg>`;

const CULTURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v18l8-3 8 3V4c0-1.1-.9-2-2-2z"/></svg>`;

const TRADITION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4a8 8 0 100 16 8 8 0 000-16zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>`;

const FOOD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 9V3H9v4H7V3H5v6c0 1.66 1.34 3 3 3v9h2v-9c1.66 0 3-1.34 3-3zm5-3v8h2.5v8H21V3c-2.76 0-5 2.24-5 3z"/></svg>`;

const LOCKED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>`;

// ============================================================================
// Mappe interne
// ============================================================================

const CATEGORY_ICONS: Record<QuestCategory, string> = {
  monument: MONUMENT_SVG,
  nature: NATURE_SVG,
  culture: CULTURE_SVG,
  tradition: TRADITION_SVG,
  food: FOOD_SVG,
};

const STATUS_ICONS: Partial<Record<QuestStatus, string>> = {
  locked: LOCKED_SVG,
  // Per discovered e available usiamo l'icona della categoria.
  // Locked sovrascrive con il lucchetto indipendentemente dalla categoria.
};

// ============================================================================
// API pubblica
// ============================================================================

/**
 * Restituisce la stringa SVG appropriata per una quest in base al suo stato.
 * Quest locked -> lucchetto. Altre -> icona della categoria.
 */
export function getQuestIcon(quest: {
  status: QuestStatus;
  category: QuestCategory;
}): string {
  return STATUS_ICONS[quest.status] ?? CATEGORY_ICONS[quest.category];
}

/** Esposto per casi d'uso specifici (es. legend, filtri). */
export function getCategoryIcon(category: QuestCategory): string {
  return CATEGORY_ICONS[category];
}

/** Esposto per coerenza, utile se serve mostrare il lucchetto altrove. */
export function getLockedIcon(): string {
  return LOCKED_SVG;
}