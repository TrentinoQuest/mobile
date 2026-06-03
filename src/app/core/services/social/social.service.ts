import { Injectable, signal } from '@angular/core';
import type { FriendActivity, FriendSuggestion } from './social.types';

// TODO: sostituire con repository HTTP quando il backend implementa /social/*
@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly _activities = signal<FriendActivity[]>(MOCK_ACTIVITIES);
  private readonly _suggestions = signal<FriendSuggestion[]>(MOCK_SUGGESTIONS);
  private readonly _friendCount = signal(14);

  readonly activities = this._activities.asReadonly();
  readonly suggestions = this._suggestions.asReadonly();
  readonly friendCount = this._friendCount.asReadonly();
}

const MOCK_ACTIVITIES: FriendActivity[] = [
  {
    id: 'a1',
    friendUsername: 'Giulia',
    verb: 'ha sbloccato',
    placeName: 'Madonna di Campiglio',
    area: 'Rendena',
    when: '12 min fa',
    avatarSeed: 0,
  },
  {
    id: 'a2',
    friendUsername: 'Luca',
    verb: 'ha completato',
    placeName: 'Trento Centro',
    area: 'Trento',
    when: '1 ora fa',
    avatarSeed: 1,
  },
  {
    id: 'a3',
    friendUsername: 'Sara',
    verb: 'ha iniziato la quest',
    placeName: 'Brenta',
    area: 'Val di Non',
    when: '3 ore fa',
    avatarSeed: 2,
  },
  {
    id: 'a4',
    friendUsername: 'Andrea',
    verb: 'ha sbloccato',
    placeName: 'Eremo S. Colombano',
    area: 'Vallagarina',
    when: 'ieri',
    avatarSeed: 3,
  },
  {
    id: 'a5',
    friendUsername: 'Chiara',
    verb: 'ha scoperto',
    placeName: 'Lago di Tovel',
    area: 'Val di Non',
    when: '2 giorni fa',
    avatarSeed: 4,
  },
];

const MOCK_SUGGESTIONS: FriendSuggestion[] = [
  { id: 's1', username: 'Elena', collectiblesCount: 12, avatarSeed: 0 },
  { id: 's2', username: 'Davide', collectiblesCount: 21, avatarSeed: 1 },
  { id: 's3', username: 'Martina', collectiblesCount: 18, avatarSeed: 2 },
  { id: 's4', username: 'Paolo', collectiblesCount: 9, avatarSeed: 3 },
  { id: 's5', username: 'Federica', collectiblesCount: 30, avatarSeed: 4 },
];
