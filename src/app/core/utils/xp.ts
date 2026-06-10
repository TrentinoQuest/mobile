/**
 * Soglie XP dei livelli, condivise tra header e profilo.
 *
 * XP_THRESHOLDS[i] = XP necessari per ENTRARE nel livello i+1
 * (indice 0 = inizio livello 1 = 0 XP). Devono restare allineate alle
 * soglie del backend; il backend espone anche Player.xpToNextLevel come
 * fonte autoritativa per il delta al prossimo livello.
 */
export const XP_THRESHOLDS = [0, 200, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000];

export const MAX_LEVEL = XP_THRESHOLDS.length;

/** Percentuale di completamento del livello corrente, clampata a [0, 100]. */
export function xpProgressPercent(level: number, xp: number): number {
  if (level >= MAX_LEVEL) return 100;
  const start = XP_THRESHOLDS[level - 1];
  const end = XP_THRESHOLDS[level];
  if (end === start) return 100;
  return Math.min(100, Math.max(0, Math.round(((xp - start) / (end - start)) * 100)));
}

/** XP mancanti al prossimo livello, o null se il livello e' gia' il massimo. */
export function xpToNextLevel(level: number, xp: number): number | null {
  if (level >= MAX_LEVEL) return null;
  return Math.max(0, XP_THRESHOLDS[level] - xp);
}
