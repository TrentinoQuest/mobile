import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { CollectibleRarity } from '@trentino-quest/shared-types';
import { PlayerProfileRepository } from './player-profile.repository';
import type { CollectibleEntry, ProgressSummary } from '../player-profile.types';

@Injectable()
export class MockPlayerProfileRepository extends PlayerProfileRepository {
  private readonly LATENCY = 300;

  override getCollection(): Observable<CollectibleEntry[]> {
    return of(MOCK_COLLECTION).pipe(delay(this.LATENCY));
  }

  override getProgress(_zone?: string): Observable<ProgressSummary> {
    return of(MOCK_PROGRESS).pipe(delay(this.LATENCY));
  }
}

const MOCK_PROGRESS: ProgressSummary = {
  totalQuests: 47,
  completedQuests: 12,
  percentage: 25.5,
};

const MOCK_COLLECTION: CollectibleEntry[] = [
  {
    collectible: {
      id: 'c1',
      name: 'Lago di Tovel',
      description: 'Il lago rosso del Trentino',
      imageUrl: '',
      rarity: CollectibleRarity.RARE,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-05-28T14:30:00Z',
  },
  {
    collectible: {
      id: 'c2',
      name: 'Castel Thun',
      description: 'Fortezza medievale in Val di Non',
      imageUrl: '',
      rarity: CollectibleRarity.UNCOMMON,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-05-25T10:00:00Z',
  },
  {
    collectible: {
      id: 'c3',
      name: 'Santuario di S. Romedio',
      description: 'Eremo rupestre della Val di Non',
      imageUrl: '',
      rarity: CollectibleRarity.RARE,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-05-22T11:15:00Z',
  },
  {
    collectible: {
      id: 'c4',
      name: 'Cles',
      description: 'Capitale della Val di Non',
      imageUrl: '',
      rarity: CollectibleRarity.COMMON,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-05-20T09:00:00Z',
  },
  {
    collectible: {
      id: 'c5',
      name: 'Castel Beseno',
      description: 'La fortezza più grande del Trentino',
      imageUrl: '',
      rarity: CollectibleRarity.LEGENDARY,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-05-15T16:00:00Z',
  },
  {
    collectible: {
      id: 'c6',
      name: 'Eremo di S. Colombano',
      description: 'Eremo scavato nella roccia',
      imageUrl: '',
      rarity: CollectibleRarity.RARE,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-05-10T13:30:00Z',
  },
  {
    collectible: {
      id: 'c7',
      name: 'Rovereto',
      description: 'La città della pace',
      imageUrl: '',
      rarity: CollectibleRarity.UNCOMMON,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-05-05T11:00:00Z',
  },
  {
    collectible: {
      id: 'c8',
      name: 'Borgo di Rango',
      description: 'Borgo medievale intatto',
      imageUrl: '',
      rarity: CollectibleRarity.UNCOMMON,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-04-28T14:00:00Z',
  },
  {
    collectible: {
      id: 'c9',
      name: 'Lago di Tenno',
      description: 'Lago dalle acque turchesi',
      imageUrl: '',
      rarity: CollectibleRarity.RARE,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-04-20T10:00:00Z',
  },
  {
    collectible: {
      id: 'c10',
      name: 'Arco',
      description: 'Città della pietra e del vento',
      imageUrl: '',
      rarity: CollectibleRarity.COMMON,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-04-10T15:00:00Z',
  },
  {
    collectible: {
      id: 'c11',
      name: 'Tonadico',
      description: 'Cuore del Primiero',
      imageUrl: '',
      rarity: CollectibleRarity.COMMON,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-04-01T12:00:00Z',
  },
  {
    collectible: {
      id: 'c12',
      name: 'Pergine Valsugana',
      description: 'Il castello sul lago',
      imageUrl: '',
      rarity: CollectibleRarity.UNCOMMON,
      createdAt: '2026-01-01T00:00:00Z',
    },
    unlockedAt: '2026-03-20T09:30:00Z',
  },
];
