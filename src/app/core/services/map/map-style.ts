import type { StyleSpecification } from 'maplibre-gl';

/**
 * Stile MapLibre custom di Trentino Quest — "il campo da gioco".
 *
 * Non usiamo uno stile generico (liberty/positron): qui costruiamo a mano
 * un look cinematografico, coerente coi token del brand, che faccia sembrare
 * la mappa l'arena di un gioco — non una mappa stradale.
 *
 * Sorgente dati: vector tiles OpenFreeMap (schema OpenMapTiles).
 * - source vettoriale: openmaptiles → https://tiles.openfreemap.org/planet
 * - glyphs (font label): https://tiles.openfreemap.org/fonts/...
 * Font disponibili lato server: "Noto Sans Regular | Bold | Italic".
 *
 * Architettura: una sola funzione costruisce i layer da una PALETTE, cosi'
 * supportiamo due "ore del giorno" (dark cinematografico / light caldo)
 * senza duplicare la struttura. Default: dark (scelta di design).
 *
 * 3D: il source-layer "building" espone render_height / render_min_height,
 * usati dal layer fill-extrusion. La camera pitchata + edifici estrusi danno
 * l'effetto Pokémon-Go. Vedi home.page.ts per pitch/bearing.
 *
 * NOTA crediti: attributionControl e' disattivato in home.page.ts su richiesta.
 * OpenFreeMap non richiede attribution obbligatoria (dati ODbL OSM: il credito
 * andra' reintrodotto in una sezione "crediti" dedicata dell'app — TODO).
 */

const TILE_HOST = 'https://tiles.openfreemap.org';
const VECTOR_SOURCE_URL = `${TILE_HOST}/planet`;
const GLYPHS_URL = `${TILE_HOST}/fonts/{fontstack}/{range}.pbf`;

export type MapMode = 'dark' | 'light';

/** Tinte di un'ora del giorno. Un layer builder le consuma per produrre i paint. */
interface MapPalette {
  /** Sfondo base sotto ogni cosa. */
  background: string;
  /** Acqua (laghi, fiumi larghi). */
  water: string;
  waterLabel: string;
  waterLabelHalo: string;
  /** Boschi / vegetazione fitta. */
  wood: string;
  /** Prati / verde aperto. */
  grass: string;
  /** Parchi urbani. */
  park: string;
  /** Aree edificate (riempimento landuse). */
  landuse: string;
  /** Edifici — riempimento piatto (zoom medi). */
  buildingFlat: string;
  /** Edifici 3D — base e cima (gradiente verticale per altezza). */
  building3dLow: string;
  building3dHigh: string;
  /** Strade principali (warm, fanno da "vene" luminose). */
  roadMajor: string;
  /** Strade secondarie / minori. */
  roadMinor: string;
  /** Sentieri / track (rilevanti per l'esplorazione a piedi). */
  roadPath: string;
  /** Confini amministrativi. */
  boundary: string;
  /** Label luoghi principali. */
  placeLabel: string;
  placeLabelHalo: string;
  /** Label luoghi minori. */
  placeMinorLabel: string;
  /** Atmosfera (sky) quando la camera e' pitchata. */
  skyTop: string;
  skyHorizon: string;
  fog: string;
}

const DARK_PALETTE: MapPalette = {
  background: '#0e0e12',
  water: '#0b1a24',
  waterLabel: '#4d6b7d',
  waterLabelHalo: '#06121a',
  wood: '#12231a',
  grass: '#16241b',
  park: '#142a1d',
  landuse: '#141418',
  buildingFlat: '#1b1b22',
  building3dLow: '#1c1c24',
  building3dHigh: '#2e2e3a',
  roadMajor: '#3a352b',
  roadMinor: '#1e1e24',
  roadPath: '#2a261d',
  boundary: '#2e2e38',
  placeLabel: '#f4ebdc',
  placeLabelHalo: '#08080b',
  placeMinorLabel: '#9c968a',
  skyTop: '#090912',
  skyHorizon: '#241826',
  fog: '#0e0e12',
};

const LIGHT_PALETTE: MapPalette = {
  background: '#ece6da',
  water: '#a9cfe0',
  waterLabel: '#3f6273',
  waterLabelHalo: '#eef4f7',
  wood: '#cddcc0',
  grass: '#d9e3c9',
  park: '#cfe0c2',
  landuse: '#e7e0d2',
  buildingFlat: '#ded5c4',
  building3dLow: '#e2d9c8',
  building3dHigh: '#f1ebdf',
  roadMajor: '#ffffff',
  roadMinor: '#f4efe5',
  roadPath: '#e6dcc8',
  boundary: '#c4b9a5',
  placeLabel: '#33302a',
  placeLabelHalo: '#f3eee3',
  placeMinorLabel: '#6b6354',
  skyTop: '#bcd6e6',
  skyHorizon: '#e9ddc9',
  fog: '#dfe6e0',
};

/** Preferisce il nome italiano, poi latino, poi quello di default del dato. */
const NAME_FIELD: unknown = [
  'coalesce',
  ['get', 'name:it'],
  ['get', 'name:latin'],
  ['get', 'name'],
];

/**
 * Costruisce lo stile completo per la modalita' richiesta.
 * Default 'dark' — il mondo di gioco e' cinematografico-notturno.
 */
export function buildGameMapStyle(mode: MapMode = 'dark'): StyleSpecification {
  const p = mode === 'light' ? LIGHT_PALETTE : DARK_PALETTE;

  const style = {
    version: 8,
    name: `trentino-quest-${mode}`,
    glyphs: GLYPHS_URL,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: VECTOR_SOURCE_URL,
      },
    },
    // Atmosfera: orizzonte sfumato + nebbia, visibili solo con camera pitchata.
    sky: {
      'sky-color': p.skyTop,
      'sky-horizon-blend': 0.6,
      'horizon-color': p.skyHorizon,
      'horizon-fog-blend': 0.7,
      'fog-color': p.fog,
      'fog-ground-blend': 0.4,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 12, 0.4, 16, 0.1],
    },
    light: {
      anchor: 'viewport',
      color: mode === 'dark' ? '#ffe9c2' : '#ffffff',
      intensity: mode === 'dark' ? 0.35 : 0.5,
      position: [1.4, 210, 30],
    },
    layers: [
      // -- Sfondo base ----------------------------------------------------
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': p.background },
      },
      // -- Vegetazione ----------------------------------------------------
      {
        id: 'landcover-wood',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: {
          'fill-color': p.wood,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 13, 0.85],
        },
      },
      {
        id: 'landcover-grass',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['grass', 'wetland'], true, false],
        paint: { 'fill-color': p.grass, 'fill-opacity': 0.6 },
      },
      // -- Aree edificate (riempimento tenue) -----------------------------
      {
        id: 'landuse-built',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: [
          'match',
          ['get', 'class'],
          ['residential', 'commercial', 'industrial'],
          true,
          false,
        ],
        minzoom: 11,
        paint: {
          'fill-color': p.landuse,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 0.7],
        },
      },
      // -- Parchi ---------------------------------------------------------
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': p.park, 'fill-opacity': 0.55 },
      },
      // -- Acqua ----------------------------------------------------------
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': p.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        minzoom: 11,
        paint: {
          'line-color': p.water,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 2.5],
        },
      },
      // -- Strade ---------------------------------------------------------
      // Sentieri/track: importanti per chi esplora a piedi, tratteggiati.
      {
        id: 'road-path',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['path', 'track'], true, false],
        minzoom: 13,
        paint: {
          'line-color': p.roadPath,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 18, 2.5],
          'line-dasharray': [2, 2],
          'line-opacity': 0.8,
        },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['minor', 'service'], true, false],
        minzoom: 13,
        paint: {
          'line-color': p.roadMinor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 6],
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
          true,
          false,
        ],
        minzoom: 9,
        paint: {
          'line-color': p.roadMajor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 2.5, 18, 9],
          'line-opacity': 0.9,
        },
      },
      // -- Confini --------------------------------------------------------
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 6],
        paint: {
          'line-color': p.boundary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 12, 1.4],
          'line-dasharray': [3, 3],
          'line-opacity': 0.7,
        },
      },
      // -- Edifici --------------------------------------------------------
      // Riempimento piatto nei zoom medi, poi cede il passo al 3D.
      {
        id: 'building-flat',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 12,
        maxzoom: 15,
        paint: {
          'fill-color': p.buildingFlat,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 0.7, 15, 0],
        },
      },
      // Estrusione 3D: il cuore dell'effetto "campo da gioco" pitchato.
      {
        id: 'building-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          // Colore per altezza: edifici alti piu' chiari → senso di profondita'.
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'render_height'],
            0,
            p.building3dLow,
            40,
            p.building3dHigh,
            120,
            p.building3dHigh,
          ],
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14,
            0,
            15.5,
            ['get', 'render_height'],
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14,
            0,
            15.5,
            ['get', 'render_min_height'],
          ],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      // -- Label acqua ----------------------------------------------------
      {
        id: 'water-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        minzoom: 12,
        layout: {
          'text-field': NAME_FIELD,
          'text-font': ['Noto Sans Italic'],
          'text-size': 12,
          'text-letter-spacing': 0.1,
          'text-max-width': 6,
        },
        paint: {
          'text-color': p.waterLabel,
          'text-halo-color': p.waterLabelHalo,
          'text-halo-width': 1,
        },
      },
      // -- Label luoghi minori (villaggi, sobborghi) ----------------------
      {
        id: 'place-minor',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: [
          'match',
          ['get', 'class'],
          ['village', 'suburb', 'neighbourhood', 'hamlet'],
          true,
          false,
        ],
        minzoom: 12,
        layout: {
          'text-field': NAME_FIELD,
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 13],
          'text-letter-spacing': 0.05,
          'text-max-width': 7,
        },
        paint: {
          'text-color': p.placeMinorLabel,
          'text-halo-color': p.placeLabelHalo,
          'text-halo-width': 1.2,
        },
      },
      // -- Label luoghi principali (citta', paesi) ------------------------
      {
        id: 'place-major',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
        layout: {
          'text-field': NAME_FIELD,
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 12, 18, 16, 22],
          'text-letter-spacing': 0.04,
          'text-max-width': 8,
          'text-transform': 'uppercase',
        },
        paint: {
          'text-color': p.placeLabel,
          'text-halo-color': p.placeLabelHalo,
          'text-halo-width': 1.6,
          'text-halo-blur': 0.5,
        },
      },
    ],
  };

  // Cast unico: le espressioni MapLibre sono tipizzate in modo molto stretto,
  // ma la struttura e' conforme alla StyleSpecification v8.
  return style as unknown as StyleSpecification;
}
