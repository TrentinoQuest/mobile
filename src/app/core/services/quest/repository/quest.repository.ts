import { Observable } from 'rxjs';
import {
  AnyQuest,
  CheckInRequest,
  CheckInResponse,
  Completion,
  CompletionEntry,
  QuestType,
  ScanQrRequest,
  ScanQrResponse,
} from '../quest.types';

/**
 * Filtro geografico per la query delle quest.
 * Allineato ai query parameter di GET /quests (lat, lng, radiusMeters).
 *
 * Se omesso, il backend restituisce TUTTE le quest attive (uso solo
 * in fase di sviluppo o per il backoffice; il client mobile dovrebbe
 * sempre passare un filtro per limitare il payload).
 */
export interface QuestSearchFilter {
  /** Centro geografico della ricerca. */
  lat: number;
  /** Longitudine del centro. */
  lng: number;
  /** Raggio in metri (100 <= r <= 50000). */
  radiusMeters: number;
  /** Filtra solo quest principali o solo secondarie. */
  type?: QuestType;
}

/**
 * QuestRepository — contratto astratto per l'accesso ai dati quest.
 *
 * Allineato al contratto OpenAPI v0.2.0 del backend. Tutti i metodi
 * mappano 1:1 a un endpoint REST (vedi commento di ogni metodo).
 *
 * Pattern: Repository.
 * Astrae completamente la fonte dei dati. Il QuestService (e per
 * estensione la HomePage) non sa se i dati vengono da mock hardcoded,
 * HTTP, cache locale o file. Dipende solo da questa interfaccia.
 *
 * Implementazioni:
 * - MockQuestRepository: dati hardcoded in memoria (sviluppo iniziale)
 * - HttpQuestRepository: chiamate REST al backend (produzione)
 *
 * Configurazione:
 * Il binding tra QuestRepository e la sua implementazione concreta
 * avviene in main.ts via Angular DI provider:
 *
 *   { provide: QuestRepository, useClass: MockQuestRepository }
 *   // oppure quando il backend e' pronto:
 *   { provide: QuestRepository, useClass: HttpQuestRepository }
 *
 * Stile API:
 * Tutti i metodi restituiscono Observable<T> per supportare cancellazione,
 * retry, e composizione con operatori RxJS.
 *
 * E' una classe abstract (non interface) perche' Angular DI puo' usare
 * la classe come token di injection.
 */
export abstract class QuestRepository {
  /**
   * Recupera le quest attive sul territorio.
   *
   * Endpoint: GET /quests
   * Query: lat, lng, radiusMeters, type (tutti opzionali)
   *
   * Restituisce AnyQuest[] = (PrimaryQuest | SecondaryQuest)[].
   * Il client discrimina via quest.type per il rendering.
   *
   * @param filter filtro geografico/tipo. Se omesso, tutte le quest.
   */
  abstract getQuests(filter?: QuestSearchFilter): Observable<AnyQuest[]>;

  /**
   * Recupera i dettagli di una singola quest per ID.
   *
   * Endpoint: GET /quests/{id}
   *
   * Usato in futuro per la Quest Detail page.
   */
  abstract getQuestById(questId: string): Observable<AnyQuest>;

  /**
   * Feed dei completamenti del giocatore corrente.
   *
   * Endpoint: GET /player/completions
   * Query: limit, offset
   *
   * Restituisce CompletionEntry[] (completion + quest associata
   * denormalizzata, evita chiamate aggiuntive).
   *
   * Usato dalla home per derivare lo stato delle quest (discovered/available).
   */
  abstract getCompletions(limit?: number, offset?: number): Observable<CompletionEntry[]>;

  /**
   * Completa una quest secondaria via check-in geolocalizzato.
   *
   * Endpoint: POST /quests/{id}/check-in
   * Body: { position: GeoPoint }
   *
   * Il backend valida che la posizione sia entro checkInRadiusMeters
   * dalla posizione della quest. Risposta 409 se gia' completata o
   * fuori raggio.
   *
   * @param questId ID della secondary quest
   * @param body posizione GPS corrente del giocatore
   */
  abstract checkIn(questId: string, body: CheckInRequest): Observable<CheckInResponse>;

  /**
   * Completa una quest principale via scansione QR + validazione GPS.
   *
   * Endpoint: POST /quests/{id}/scan
   * Body: { qrToken: string, position: GeoPoint }
   *
   * Sblocca il collectible associato alla quest.
   *
   * @param questId ID della primary quest
   * @param body token QR scansionato + posizione GPS
   */
  abstract scan(questId: string, body: ScanQrRequest): Observable<ScanQrResponse>;
}