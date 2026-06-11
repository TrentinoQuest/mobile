import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { PlayerProfileRepository } from './player-profile.repository';
import type { CollectibleEntry, ProgressSummary } from '../player-profile.types';

@Injectable()
export class HttpPlayerProfileRepository extends PlayerProfileRepository {
  private readonly http = inject(HttpClient);

  override getCollection(): Observable<CollectibleEntry[]> {
    return this.http.get<CollectibleEntry[]>(`${environment.apiUrl}/player/collection`);
  }

  override getProgress(zone?: string): Observable<ProgressSummary> {
    const params: Record<string, string> = {};
    if (zone) params['zone'] = zone;
    return this.http.get<ProgressSummary>(`${environment.apiUrl}/player/progress`, { params });
  }
}
