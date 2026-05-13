import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { QuestRepository } from '../repository/quest.repository';
import { GeoBounds, Quest, Zone } from '../quest.types';
import { environment } from '../../../../../environments/environment';

/**
 * HttpQuestRepository — implementazione del contratto QuestRepository
 * che parla col backend reale via HTTP.
 *
 * STATO: STUB. Gli endpoint del backend per le quest non sono ancora
 * implementati (vedi brief progetto). Tutti i metodi lanciano errore.
 *
 * QUANDO IMPLEMENTARE:
 * Quando il backend espone gli endpoint /api/zones e /api/quests, sostituire
 * il corpo dei metodi con le chiamate HTTP corrispondenti.
 *
 * Esempio di implementazione (riferimento, NON ATTIVO):
 *
 *   getZones(): Observable<Zone[]> {
 *     return this.http.get<Zone[]>(`${this.apiUrl}/zones`);
 *   }
 *
 *   getQuestsInBounds(bounds?: GeoBounds): Observable<Quest[]> {
 *     const params = bounds ? {
 *       sw_lat: bounds.southWest.lat,
 *       sw_lng: bounds.southWest.lng,
 *       ne_lat: bounds.northEast.lat,
 *       ne_lng: bounds.northEast.lng,
 *     } : {};
 *     return this.http.get<Quest[]>(`${this.apiUrl}/quests`, { params });
 *   }
 *
 *   markAsDiscovered(questId: string): Observable<Quest> {
 *     return this.http.post<Quest>(
 *       `${this.apiUrl}/quests/${questId}/discover`,
 *       {}
 *     );
 *   }
 *
 * L'authInterceptor esistente attaccera' automaticamente il Bearer token
 * a queste richieste perche' usano apiUrl.
 *
 * PER ATTIVARE:
 * In app.config.ts, cambiare:
 *   { provide: QuestRepository, useClass: MockQuestRepository }
 * in:
 *   { provide: QuestRepository, useClass: HttpQuestRepository }
 */
@Injectable()
export class HttpQuestRepository extends QuestRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  override getZones(): Observable<Zone[]> {
    throw new Error(
      'HttpQuestRepository.getZones() non implementato. ' +
        'Backend quest non disponibile. Usa MockQuestRepository per ora.',
    );
  }

  override getQuestsInBounds(_bounds?: GeoBounds): Observable<Quest[]> {
    throw new Error(
      'HttpQuestRepository.getQuestsInBounds() non implementato. ' +
        'Backend quest non disponibile. Usa MockQuestRepository per ora.',
    );
  }

  override markAsDiscovered(_questId: string): Observable<Quest> {
    throw new Error(
      'HttpQuestRepository.markAsDiscovered() non implementato. ' +
        'Backend quest non disponibile. Usa MockQuestRepository per ora.',
    );
  }
}