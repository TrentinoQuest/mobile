import {
  TRENTINO_VALLEYS,
  type ValleyData,
} from '../../../features/giocatore/home/trentino-valleys.data';
import type { AnyQuest, PrimaryQuest, SecondaryQuest } from '../quest/quest.types';
import { QuestType } from '../quest/quest.types';
import type { PlayerQuestStatus } from '../quest/quest.types';

function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function questCoords(q: AnyQuest): [number, number] {
  if (q.type === QuestType.PRIMARY) {
    const p = q as PrimaryQuest;
    return [p.searchArea.lng, p.searchArea.lat];
  }
  const s = q as SecondaryQuest;
  return [s.position.lng, s.position.lat];
}

export interface ValleyCluster {
  name: string;
  centroid: [number, number];
  count: number;
}

export function buildValleyClusters(
  quests: AnyQuest[],
  playerStatusOf: (id: string) => PlayerQuestStatus,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const counts = new Map<string, number>();

  for (const q of quests) {
    const [lng, lat] = questCoords(q);
    for (const valley of TRENTINO_VALLEYS) {
      if (pointInRing(lng, lat, valley.ring)) {
        counts.set(valley.name, (counts.get(valley.name) ?? 0) + 1);
        break;
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features: TRENTINO_VALLEYS.filter((v: ValleyData) => (counts.get(v.name) ?? 0) > 0).map(
      (v: ValleyData) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: v.centroid },
        properties: {
          valleyName: v.name,
          questCount: counts.get(v.name) ?? 0,
        },
      }),
    ),
  };
}
