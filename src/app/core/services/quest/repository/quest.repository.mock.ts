import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { QuestRepository, QuestSearchFilter } from './quest.repository';
import {
  AnyQuest,
  CheckInRequest,
  CheckInResponse,
  Completion,
  CompletionEntry,
  PrimaryQuest,
  QuestStatus,
  QuestType,
  ScanQrRequest,
  ScanQrResponse,
  SecondaryQuest,
  Collectible,
  CollectibleRarity,
  CollectibleEntry,
} from '../quest.types';

/**
 * MockQuestRepository — implementazione del contratto QuestRepository
 * con dati hardcoded in memoria.
 *
 * NATURA TEMPORANEA: questo file vive finche' il backend non implementa
 * gli endpoint quest. Quando l'integrazione sara' verificata, configurare
 * l'app per usare HttpQuestRepository e cancellare questo file.
 *
 * Allineamento ai DTO OpenAPI v0.2.0:
 * I dati hardcoded usano i tipi veri di shared-types (PrimaryQuest,
 * SecondaryQuest, Completion). Quando il backend sara' live, lo switch
 * sara' trasparente: stesso shape dei dati, fonte diversa.
 *
 * Simulazione realistica:
 * - delay(250ms) su ogni metodo per imitare latenza HTTP
 * - checkIn() e scan() validano distanze e stati come fara' il backend
 * - I completion sono mantenuti in memoria e crescono ad ogni completamento
 *   riuscito (cosi' loadQuests + derivePlayerStatus mostrano lo stato corretto)
 *
 * Dati mock:
 * - 3 PrimaryQuest (con QR + collectible): Duomo, Castello, Mausoleo
 * - 5 SecondaryQuest (check-in): Fontana Nettuno, Belenzani, Torre Vanga,
 *   Bottega Casaro, Belvedere
 * - 2 Completion iniziali (Fontana Nettuno e Mausoleo gia' fatti)
 */
@Injectable()
export class MockQuestRepository extends QuestRepository {
  // Latenza simulata per imitare una richiesta HTTP reale.
  private readonly MOCK_LATENCY_MS = 250;

  // ----------------------------------------------------------------
  // API pubblica del repository
  // ----------------------------------------------------------------

  override getQuests(filter?: QuestSearchFilter): Observable<AnyQuest[]> {
    let result = this.quests;

    // Filtro per tipo
    if (filter?.type !== undefined) {
      result = result.filter((q) => q.type === filter.type);
    }

    // Filtro geografico approssimato (bounding box invece di cerchio per
    // semplicita'; il backend usera' una query geo-spatial vera).
    if (filter && filter.radiusMeters > 0) {
      result = result.filter((q) => {
        const pos = this.getQuestPosition(q);
        const distance = this.haversineMeters(filter.lat, filter.lng, pos.lat, pos.lng);
        return distance <= filter.radiusMeters;
      });
    }

    return of(result).pipe(
      delay(this.MOCK_LATENCY_MS),
      // Copia per evitare mutazioni accidentali sull'array interno.
      map((quests) => quests.map((q) => ({ ...q }))),
    );
  }

  override getQuestById(questId: string): Observable<AnyQuest> {
    const quest = this.quests.find((q) => q.id === questId);
    if (!quest) {
      return throwError(() => new Error(`Quest non trovata: ${questId}`));
    }
    return of({ ...quest }).pipe(delay(this.MOCK_LATENCY_MS));
  }

  override getCompletions(limit = 20, offset = 0): Observable<CompletionEntry[]> {
    // Ordina per data decrescente (come da spec OpenAPI).
    const sorted = [...this.completions].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
    const paged = sorted.slice(offset, offset + limit);

    // Denormalizza: aggiunge la quest associata a ogni completion.
    const entries: CompletionEntry[] = paged.map((completion) => {
      const quest = this.quests.find((q) => q.id === completion.questId);
      if (!quest) {
        throw new Error(
          `Completion ${completion.id} riferisce a quest mancante ${completion.questId}`,
        );
      }
      return { completion: { ...completion }, quest: { ...quest } };
    });

    return of(entries).pipe(delay(this.MOCK_LATENCY_MS));
  }

  override checkIn(questId: string, body: CheckInRequest): Observable<CheckInResponse> {
    const quest = this.quests.find((q) => q.id === questId);

    if (!quest) {
      return throwError(() => new Error(`Quest non trovata: ${questId}`));
    }
    if (quest.type !== QuestType.SECONDARY) {
      return throwError(
        () => new Error(`Check-in non valido: la quest ${questId} non e' secondary`),
      );
    }
    if (this.isAlreadyCompleted(questId)) {
      return throwError(() => new Error(`Quest gia' completata: ${questId}`));
    }

    const secondary = quest as SecondaryQuest;
    const distance = this.haversineMeters(
      body.position.lat,
      body.position.lng,
      secondary.position.lat,
      secondary.position.lng,
    );

    if (distance > secondary.checkInRadiusMeters) {
      return throwError(
        () =>
          new Error(`Fuori raggio: ${Math.round(distance)}m / ${secondary.checkInRadiusMeters}m`),
      );
    }

    // Successo: crea il completion.
    const completion: Completion = {
      id: `c-${Date.now()}`,
      questId,
      pointsAwarded: secondary.basePoints,
      position: body.position,
      completedAt: new Date().toISOString(),
    };
    this.completions.push(completion);
    this.playerTotalPoints += completion.pointsAwarded;

    const response: CheckInResponse = {
      completion,
      pointsAwarded: completion.pointsAwarded,
      totalPoints: this.playerTotalPoints,
      distanceFromTargetMeters: distance,
    };

    return of(response).pipe(delay(this.MOCK_LATENCY_MS));
  }

  override scan(questId: string, body: ScanQrRequest): Observable<ScanQrResponse> {
    const quest = this.quests.find((q) => q.id === questId);

    if (!quest) {
      return throwError(() => new Error(`Quest non trovata: ${questId}`));
    }
    if (quest.type !== QuestType.PRIMARY) {
      return throwError(() => new Error(`Scan non valido: la quest ${questId} non e' primary`));
    }
    if (this.isAlreadyCompleted(questId)) {
      return throwError(() => new Error(`Quest gia' completata: ${questId}`));
    }

    const primary = quest as PrimaryQuest;
    const distance = this.haversineMeters(
      body.position.lat,
      body.position.lng,
      primary.searchArea.lat,
      primary.searchArea.lng,
    );

    if (distance > primary.searchRadiusMeters) {
      return throwError(
        () => new Error(`Fuori raggio: ${Math.round(distance)}m / ${primary.searchRadiusMeters}m`),
      );
    }

    // Validazione token mock: accetta qualsiasi stringa non vuota.
    // Il backend reale verifichera' il token contro il DB.
    if (!body.qrToken || body.qrToken.length < 4) {
      return throwError(() => new Error(`Token QR non valido`));
    }

    const completion: Completion = {
      id: `c-${Date.now()}`,
      questId,
      pointsAwarded: primary.basePoints,
      position: body.position,
      completedAt: new Date().toISOString(),
    };
    this.completions.push(completion);
    this.playerTotalPoints += completion.pointsAwarded;

    // Recupera il collectible associato (mock: sempre disponibile).
    const collectible = this.collectibles.find((c) => c.id === primary.collectibleId);
    if (!collectible) {
      return throwError(() => new Error(`Collectible non trovato per quest primary ${questId}`));
    }

    const response: ScanQrResponse = {
      completion,
      pointsAwarded: completion.pointsAwarded,
      totalPoints: this.playerTotalPoints,
      collectible: { ...collectible },
      distanceFromTargetMeters: distance,
    };

    return of(response).pipe(delay(this.MOCK_LATENCY_MS));
  }

  // ----------------------------------------------------------------
  // Utility private
  // ----------------------------------------------------------------

  /**
   * Estrae la posizione di una quest indipendentemente dal tipo.
   * Primary -> searchArea. Secondary -> position.
   */
  private getQuestPosition(quest: AnyQuest): { lat: number; lng: number } {
    return quest.type === QuestType.PRIMARY ? quest.searchArea : quest.position;
  }

  /** Distanza Haversine tra due punti in metri. */
  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // raggio terrestre in metri
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  private isAlreadyCompleted(questId: string): boolean {
    return this.completions.some((c) => c.questId === questId);
  }

  // ================================================================
  // DATI MOCK
  // ================================================================
  // Hardcoded in-memory. Allineati ai DTO veri di shared-types.
  // Coordinate reali di punti di interesse di Trento.
  // ================================================================

  /** Punti totali del giocatore (somma dei completion). */
  private playerTotalPoints = 90; // = 30 (Fontana) + 60 (Mausoleo), match coi completion iniziali

  /** Collectibles disponibili. Ognuno e' sbloccato da una primary quest. */
  // Cast a `any` localmente perche' non sappiamo la shape esatta di
  // CollectibleRarity dal tuo shared-types (potrebbe essere enum vs string).
  // Quando importi il vero tipo, rimuovi i cast.
  private readonly collectibles: Collectible[] = [
    {
      id: 'col-leone-san-marco',
      name: 'Leone di San Marco',
      description:
        'Scultura sul portale della cattedrale, simbolo dei legami ' +
        'veneziani di Trento medievale.',
      imageUrl: '/assets/collectibles/leone-san-marco.png',
      rarity: CollectibleRarity.RARE,
      createdAt: '2025-01-15T10:00:00Z',
    },
    {
      id: 'col-stemma-buonconsiglio',
      name: 'Stemma del Buonconsiglio',
      description: 'Lo stemma dei principi vescovi che governarono Trento per secoli.',
      imageUrl: '/assets/collectibles/stemma-buonconsiglio.png',
      rarity: CollectibleRarity.UNCOMMON,
      createdAt: '2025-01-15T10:00:00Z',
    },
    {
      id: 'col-aquila-battisti',
      name: 'Aquila di Cesare Battisti',
      description: 'Simbolo del mausoleo dedicato al patriota trentino.',
      imageUrl: '/assets/collectibles/aquila-battisti.png',
      rarity: CollectibleRarity.LEGENDARY,
      createdAt: '2025-01-15T10:00:00Z',
    },
  ];

  /** Quest del Trentino — primary + secondary. */
  private readonly quests: AnyQuest[] = [
    // ============================================================
    // PRIMARY QUEST (QR + collectible)
    // ============================================================
    {
      id: 'q-duomo',
      name: 'Cattedrale di San Vigilio',
      description:
        "La cattedrale romanico-gotica simbolo della citta'. Cerca il " +
        'leone di San Marco scolpito sul portale.',
      type: QuestType.PRIMARY,
      status: QuestStatus.ACTIVE,
      basePoints: 50,
      createdAt: '2025-01-15T10:00:00Z',
      searchArea: { lat: 46.0667, lng: 11.1211 },
      searchRadiusMeters: 80,
      collectibleId: 'col-leone-san-marco',
    } as PrimaryQuest,
    {
      id: 'q-buonconsiglio',
      name: 'Castello del Buonconsiglio',
      description:
        'Residenza dei principi vescovi. Affreschi, torri e secoli di ' + 'potere temporale.',
      type: QuestType.PRIMARY,
      status: QuestStatus.ACTIVE,
      basePoints: 80,
      createdAt: '2025-01-15T10:00:00Z',
      searchArea: { lat: 46.0727, lng: 11.1239 },
      searchRadiusMeters: 100,
      collectibleId: 'col-stemma-buonconsiglio',
    } as PrimaryQuest,
    {
      id: 'q-mausoleo',
      name: 'Mausoleo di Cesare Battisti',
      description:
        "Monumento funebre eretto in cima al Doss. Vista sull'intera " + "Valle dell'Adige.",
      type: QuestType.PRIMARY,
      status: QuestStatus.ACTIVE,
      basePoints: 60,
      createdAt: '2025-01-15T10:00:00Z',
      searchArea: { lat: 46.0741, lng: 11.1116 },
      searchRadiusMeters: 60,
      collectibleId: 'col-aquila-battisti',
    } as PrimaryQuest,

    // ============================================================
    // SECONDARY QUEST (check-in geolocalizzato)
    // ============================================================
    {
      id: 'q-fontana-nettuno',
      name: 'Fontana del Nettuno',
      description:
        "Il dio del mare al centro di una citta' di montagna. Settecento " + 'in piazza Duomo.',
      type: QuestType.SECONDARY,
      status: QuestStatus.ACTIVE,
      basePoints: 30,
      createdAt: '2025-01-15T10:00:00Z',
      position: { lat: 46.0666, lng: 11.1213 },
      checkInRadiusMeters: 30,
    } as SecondaryQuest,
    {
      id: 'q-via-belenzani',
      name: 'Via Belenzani',
      description:
        "La via dei palazzi affrescati. Ogni facciata e' una pagina di " + 'storia rinascimentale.',
      type: QuestType.SECONDARY,
      status: QuestStatus.ACTIVE,
      basePoints: 40,
      createdAt: '2025-01-15T10:00:00Z',
      position: { lat: 46.0683, lng: 11.1217 },
      checkInRadiusMeters: 40,
    } as SecondaryQuest,
    {
      id: 'q-torre-vanga',
      name: 'Torre Vanga',
      description: 'Antica torre di guardia medievale, oggi sede di mostre temporanee.',
      type: QuestType.SECONDARY,
      status: QuestStatus.ACTIVE,
      basePoints: 45,
      createdAt: '2025-01-15T10:00:00Z',
      position: { lat: 46.0709, lng: 11.1183 },
      checkInRadiusMeters: 30,
    } as SecondaryQuest,
    {
      id: 'q-mercato-vigilio',
      name: 'Bottega del Casaro',
      description:
        'Piccola bottega storica vicino al mercato. Trentingrana stagionato ' + '24 mesi.',
      type: QuestType.SECONDARY,
      status: QuestStatus.ACTIVE,
      basePoints: 25,
      createdAt: '2025-01-15T10:00:00Z',
      position: { lat: 46.0676, lng: 11.1197 },
      checkInRadiusMeters: 20,
    } as SecondaryQuest,
    {
      id: 'q-belvedere-doss',
      name: 'Belvedere del Doss',
      description:
        "Il punto panoramico piu' classico. All'alba la luce taglia " +
        "orizzontalmente la citta' sottostante.",
      type: QuestType.SECONDARY,
      status: QuestStatus.ACTIVE,
      basePoints: 35,
      createdAt: '2025-01-15T10:00:00Z',
      position: { lat: 46.0739, lng: 11.1131 },
      checkInRadiusMeters: 50,
    } as SecondaryQuest,
  ];

  /**
   * Completion iniziali del giocatore.
   * Simulano "il giocatore ha gia' visitato Fontana del Nettuno e il
   * Mausoleo" — utile per testare il rendering dello stato discovered.
   */
  private readonly completions: Completion[] = [
    {
      id: 'c-init-001',
      questId: 'q-fontana-nettuno',
      pointsAwarded: 30,
      position: { lat: 46.0666, lng: 11.1213 },
      completedAt: '2025-03-10T14:23:00Z',
    },
    {
      id: 'c-init-002',
      questId: 'q-mausoleo',
      pointsAwarded: 60,
      position: { lat: 46.0741, lng: 11.1116 },
      completedAt: '2025-03-12T09:15:00Z',
    },
  ];
}
