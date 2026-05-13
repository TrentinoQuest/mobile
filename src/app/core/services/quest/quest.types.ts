/* ============================================================================
 * Quest types — contratto dati per la feature quest
 * ============================================================================
 * Tipi puri, zero logica, zero implementazione.
 *
 * MIGRAZIONE FUTURA:
 * I DTO veri per le quest vivranno nel pacchetto @trentino-quest/shared-types
 * (repo separata gestita dal collega backend).
 * Quando saranno disponibili, questo file diventera' un re-export:
 *
 *   export {
 *     Quest, Zone, QuestStatus, QuestCategory, QuestPosition, GeoBounds
 *   } from '@trentino-quest/shared-types';
 *
 * I nomi dei campi sono allineati al class diagram (mainD2.pdf, sezione
 * Quest e Collectible) per facilitare l'allineamento.
 * ========================================================================== */

/**
 * Stato di una quest dal punto di vista del giocatore corrente.
 *
 * - discovered: gia' completata, marker in forest, opacita' ridotta
 * - available: non completata ma sbloccata, marker in ocra, full opacity
 * - locked: non ancora accessibile (es. prerequisiti non soddisfatti)
 */
export type QuestStatus = 'discovered' | 'available' | 'locked';

/**
 * Categoria di quest, determina l'icona sul marker.
 * Allineato a categorie tipiche del territorio trentino.
 */
export type QuestCategory =
  | 'monument'   // chiesa, castello, palazzo storico
  | 'nature'     // panorama, cascata, sentiero
  | 'culture'    // museo, biblioteca, opera
  | 'tradition'  // borgo, fontana, dettaglio architettonico
  | 'food';      // prodotto tipico locale, bottega

/**
 * Coordinate geografiche di un punto di interesse.
 * Naming allineato a Leaflet.LatLng per facilitare la conversione.
 */
export interface QuestPosition {
  lat: number;
  lng: number;
}

/**
 * Quest secondaria: singolo collectible da scoprire.
 * Rappresentata da un marker puntuale sulla mappa.
 */
export interface Quest {
  /** ID univoco — in produzione UUID dal backend. */
  id: string;
  /** Nome visibile della quest (es. "La fontana del Nettuno"). */
  name: string;
  /** Breve descrizione mostrata nel popup / bottom sheet. */
  description: string;
  /** Posizione geografica del QR code da scansionare. */
  position: QuestPosition;
  /** Stato corrente per il giocatore. */
  status: QuestStatus;
  /** Categoria, determina l'icona. */
  category: QuestCategory;
  /** ID della zona principale di appartenenza (foreign key). */
  zoneId: string;
  /** Punti riconosciuti al completamento (secondario, vedi brief). */
  points: number;
}

/**
 * Quest principale: cluster narrativo legato a una zona geografica.
 *
 * Nel mock e' rappresentata come cerchio (centro + raggio); in produzione
 * sara' un poligono con vertici dal backend.
 */
export interface Zone {
  /** ID univoco. */
  id: string;
  /** Nome narrativo della zona (es. "Trento Storica"). */
  name: string;
  /** Breve narrazione evocativa. */
  description: string;
  /** Centro geografico della zona. */
  center: QuestPosition;
  /**
   * Raggio in metri del cerchio rappresentativo (mock-only).
   *
   * TODO: in produzione le zone saranno definite come array di vertici
   *   (poligoni), non come centro+raggio. Aggiungere campo `vertices`
   *   quando il backend lo espone, e nel HttpQuestRepository convertire.
   */
  radiusMeters: number;
}

/**
 * Bounding box geografico — usato per query "quest in questa area visibile".
 * Allineato a Leaflet.LatLngBounds.
 */
export interface GeoBounds {
  southWest: QuestPosition;
  northEast: QuestPosition;
}