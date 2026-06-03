import { Observable } from 'rxjs';
import type { CollectibleEntry, ProgressSummary } from '../player-profile.types';

export abstract class PlayerProfileRepository {
  abstract getCollection(): Observable<CollectibleEntry[]>;
  abstract getProgress(zone?: string): Observable<ProgressSummary>;
}
