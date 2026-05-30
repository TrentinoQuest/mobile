import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { QuestRepository, QuestSearchFilter } from './quest.repository';
import {
  AnyQuest,
  CheckInRequest,
  CheckInResponse,
  CompletionEntry,
  ScanQrRequest,
  ScanQrResponse,
} from '../quest.types';
import { environment } from '../../../../../environments/environment';

/**
 * HttpQuestRepository — implementazione REST del contratto QuestRepository.
 *
 * Allineata al contratto OpenAPI v0.2.0 (vedi shared-types e openapi.yaml).
 *
 * STATO ATTUALE:
 * Codice scritto e tipo-corretto. NON testabile contro un backend reale
 * perche' gli endpoint quest non sono ancora implementati lato server.
 * Quando il backend andra' live:
 * 1. Verificare il prefisso apiUrl in environment (deve includere /api/v1)
 * 2. Cambiare il provider in main.ts:
 *    da:  { provide: QuestRepository, useClass: MockQuestRepository }
 *    a:   { provide: QuestRepository, useClass: HttpQuestRepository }
 * 3. Testare end-to-end con backend running.
 *
 * Autenticazione:
 * L'authInterceptor gia' configurato in main.ts attacca automaticamente
 * il Bearer token a tutte le richieste verso apiUrl. Niente da configurare
 * a livello di repository.
 *
 * Gestione errori:
 * Errori HTTP (401, 404, 409, ...) si propagano come HttpErrorResponse via
 * Observable. Il QuestService li intercetta con catchError() e li converte
 * in messaggi user-friendly per la UI.
 */
@Injectable()
export class HttpQuestRepository extends QuestRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  override getQuests(filter?: QuestSearchFilter): Observable<AnyQuest[]> {
    let params = new HttpParams();
    if (filter) {
      params = params
        .set('lat', filter.lat)
        .set('lng', filter.lng)
        .set('radiusMeters', filter.radiusMeters);
      if (filter.type !== undefined) {
        params = params.set('type', filter.type);
      }
    }
    return this.http.get<AnyQuest[]>(`${this.apiUrl}/quests`, { params });
  }

  override getQuestById(questId: string): Observable<AnyQuest> {
    return this.http.get<AnyQuest>(`${this.apiUrl}/quests/${questId}`);
  }

  override getCompletions(limit = 20, offset = 0): Observable<CompletionEntry[]> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<CompletionEntry[]>(`${this.apiUrl}/player/completions`, { params });
  }

  override checkIn(questId: string, body: CheckInRequest): Observable<CheckInResponse> {
    return this.http.post<CheckInResponse>(`${this.apiUrl}/quests/${questId}/check-in`, body);
  }

  override scan(questId: string, body: ScanQrRequest): Observable<ScanQrResponse> {
    return this.http.post<ScanQrResponse>(`${this.apiUrl}/quests/${questId}/scan`, body);
  }
}
