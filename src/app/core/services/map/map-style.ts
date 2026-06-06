import type { StyleSpecification } from 'maplibre-gl';

/**
 * Stile MapLibre 2D di Trentino Quest — palette brand-aligned.
 *
 * Architettura: una funzione costruisce i layer da una PALETTE,
 * supportando light (default, warm paper) e dark (sera alpina).
 * Nessun 3D: pitch=0, no fill-extrusion, no sky/fog.
 *
 * Sorgente dati: vector tiles OpenFreeMap (schema OpenMapTiles).
 * Glyphs: https://tiles.openfreemap.org/fonts/...
 */

const TILE_HOST = 'https://tiles.openfreemap.org';
const VECTOR_SOURCE_URL = `${TILE_HOST}/planet`;
const GLYPHS_URL = `${TILE_HOST}/fonts/{fontstack}/{range}.pbf`;

export type MapMode = 'dark' | 'light';

interface MapPalette {
  background: string;
  water: string;
  waterLabel: string;
  waterLabelHalo: string;
  wood: string;
  grass: string;
  park: string;
  landuse: string;
  buildingFlat: string;
  roadMajor: string;
  roadMinor: string;
  roadPath: string;
  boundary: string;
  placeLabel: string;
  placeLabelHalo: string;
  placeMinorLabel: string;
}

/** Carta geografica calda — allineata al design system brand (#fafaf8 / #2d6a4f). */
const LIGHT_PALETTE: MapPalette = {
  background: '#f0ebe0',
  water: '#a8d4ec',
  waterLabel: '#3d6b80',
  waterLabelHalo: '#e8f4fa',
  wood: '#c8e0c8',
  grass: '#d8e8cc',
  park: '#c2ddb8',
  landuse: '#e8e2d4',
  buildingFlat: '#d8d0c0',
  roadMajor: '#ffffff',
  roadMinor: '#ede6d8',
  roadPath: '#dfd6c4',
  boundary: '#c0b099',
  placeLabel: '#1a1a18',
  placeLabelHalo: '#f0ebe0',
  placeMinorLabel: '#6b7068',
};

/** Sera alpina — toni profondi, verde foresta e accenti caldi. */
const DARK_PALETTE: MapPalette = {
  background: '#12181a',
  water: '#0d1e2e',
  waterLabel: '#3a5a70',
  waterLabelHalo: '#0a1218',
  wood: '#162a1e',
  grass: '#182e20',
  park: '#162c1c',
  landuse: '#161c1e',
  buildingFlat: '#1e2428',
  roadMajor: '#2e3830',
  roadMinor: '#1c2422',
  roadPath: '#263020',
  boundary: '#283030',
  placeLabel: '#e8e4dc',
  placeLabelHalo: '#0c1214',
  placeMinorLabel: '#7a8480',
};

/** Preferisce il nome italiano, poi latino, poi quello di default del dato. */
const NAME_FIELD: unknown = [
  'coalesce',
  ['get', 'name:it'],
  ['get', 'name:latin'],
  ['get', 'name'],
];

/** Costruisce lo stile 2D per la modalità richiesta. Default: 'light'. */
export function buildGameMapStyle(mode: MapMode = 'light'): StyleSpecification {
  const p = mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;

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
    layers: [
      // Sfondo base
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': p.background },
      },
      // Vegetazione — foreste
      {
        id: 'landcover-wood',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: {
          'fill-color': p.wood,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 0.9],
        },
      },
      // Prati e zone umide
      {
        id: 'landcover-grass',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['grass', 'wetland'], true, false],
        paint: { 'fill-color': p.grass, 'fill-opacity': 0.65 },
      },
      // Aree edificate (residenziale, commerciale, industriale)
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
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 13, 0.75],
        },
      },
      // Parchi
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': p.park, 'fill-opacity': 0.6 },
      },
      // Acqua
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 16, 3],
        },
      },
      // Sentieri (tratteggiati, importanti per l'esplorazione a piedi)
      {
        id: 'road-path',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['path', 'track'], true, false],
        minzoom: 13,
        paint: {
          'line-color': p.roadPath,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 18, 2.5],
          'line-dasharray': [2, 2],
          'line-opacity': 0.85,
        },
      },
      // Strade minori
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['minor', 'service'], true, false],
        minzoom: 13,
        paint: {
          'line-color': p.roadMinor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 7],
        },
      },
      // Strade principali
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 14, 3, 18, 10],
          'line-opacity': 0.95,
        },
      },
      // Confini amministrativi
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 6],
        paint: {
          'line-color': p.boundary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 12, 1.5],
          'line-dasharray': [3, 3],
          'line-opacity': 0.7,
        },
      },
      // Edifici piatti (2D)
      {
        id: 'building-flat',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-color': p.buildingFlat,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 0.85],
          'fill-outline-color': mode === 'light' ? 'rgba(180,168,148,0.4)' : 'rgba(40,52,56,0.6)',
        },
      },
      // Label acqua
      {
        id: 'water-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        minzoom: 12,
        layout: {
          'text-field': NAME_FIELD,
          'text-font': ['Noto Sans Italic'],
          'text-size': 11,
          'text-letter-spacing': 0.1,
          'text-max-width': 6,
        },
        paint: {
          'text-color': p.waterLabel,
          'text-halo-color': p.waterLabelHalo,
          'text-halo-width': 1,
        },
      },
      // Label luoghi minori
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
          'text-letter-spacing': 0.04,
          'text-max-width': 7,
        },
        paint: {
          'text-color': p.placeMinorLabel,
          'text-halo-color': p.placeLabelHalo,
          'text-halo-width': 1.2,
        },
      },
      // Label luoghi principali
      {
        id: 'place-major',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
        layout: {
          'text-field': NAME_FIELD,
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 12, 16, 16, 20],
          'text-letter-spacing': 0.04,
          'text-max-width': 8,
        },
        paint: {
          'text-color': p.placeLabel,
          'text-halo-color': p.placeLabelHalo,
          'text-halo-width': 1.8,
          'text-halo-blur': 0.5,
        },
      },
    ],
  };

  return style as unknown as StyleSpecification;
}
