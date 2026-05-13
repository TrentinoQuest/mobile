import { Observable } from 'rxjs';
import { GeoBounds, Quest, Zone } from '../quest.types';

/**
 * QuestRepository — contratto astratto per l'accesso ai dati quest.
 *
 * Pattern: Repository.
 * Astrae completamente la fonte dei dati. Il QuestService (e per
 * estensione la HomePage) non sa se i dati vengono da mock hardcoded,
 * HTTP, cache locale o file. Dipende solo da questa interfaccia.
 *
 * Implementazioni:
 * - MockQuestRepository: dati hardcoded in memoria (sviluppo iniziale)
 * - HttpQuestRepository: chiamate REST al backend (produzione, TODO)
 *
 * Configurazione:
 * Il binding tra QuestRepository e la sua implementazione concreta
 * avviene in app.config.ts via Angular DI provider:
 *
 *   { provide: QuestRepository, useClass: MockQuestRepository }
 *
 * Per passare al backend basta cambiare quella riga.
 *
 * Stile API:
 * Tutti i metodi restituiscono Observable<T>, non Promise. Motivo: le
 * Observable supportano nativamente:
 * - cancellazione (unsubscribe se l'utente naviga via)
 * - retry/error handling con operatori RxJS
 * - stream di valori (utile per real-time future, es. WebSocket)
 *
 * E' una classe abstract (non interface) perche' Angular DI puo' usare
 * la classe come token di injection. Con un'interface dovremmo definire
 * un InjectionToken separato — la classe astratta e' piu' ergonomica.
 */
export abstract class QuestRepository {
  /**
   * Recupera tutte le zone (quest principali) della regione.
   *
   * In produzione: GET /api/zones
   * Cached side: il backend probabilmente cachera' queste (cambiano poco).
   */
  abstract getZones(): Observable<Zone[]>;

  /**
   * Recupera tutte le quest secondarie dentro un bounding box geografico.
   *
   * In produzione: GET /api/quests?sw_lat=..&sw_lng=..&ne_lat=..&ne_lng=..
   *
   * Lo stato (discovered/available/locked) e' calcolato lato server in
   * base all'utente autenticato.
   *
   * @param bounds area geografica entro cui cercare; se omesso, tutte
   *   le quest dell'utente (sconsigliato in produzione per dimensione
   *   payload).
   */
  abstract getQuestsInBounds(bounds?: GeoBounds): Observable<Quest[]>;

  /**
   * Marca una quest come scoperta dall'utente corrente.
   * Chiamato dopo scansione QR validata + GPS in range.
   *
   * In produzione: POST /api/quests/{id}/discover
   *
   * @returns la Quest aggiornata con il nuovo stato.
   */
  abstract markAsDiscovered(questId: string): Observable<Quest>;
}