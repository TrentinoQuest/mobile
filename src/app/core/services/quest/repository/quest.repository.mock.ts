import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { QuestRepository } from './quest.repository';
import {
  GeoBounds,
  Quest,
  QuestCategory,
  QuestStatus,
  Zone,
} from '../quest.types';

/**
 * MockQuestRepository — implementazione del contratto QuestRepository
 * con dati hardcoded in memoria.
 *
 * NATURA TEMPORANEA: questo file vive finche' il backend non implementa
 * gli endpoint quest. Quando arriveranno, configureremo l'app per usare
 * HttpQuestRepository e questo file potra' essere cancellato.
 *
 * Simulazione realistica:
 * - I metodi restituiscono Observable con delay() artificiale per
 *   imitare la latenza di rete. Questo permette di testare lo stato
 *   di loading senza un backend.
 * - markAsDiscovered() modifica in-place l'array MOCK_QUESTS cosi'
 *   le successive chiamate a getQuestsInBounds() riflettono la
 *   modifica. Comportamento allineato a quello che fara' il backend.
 *
 * Dati mock:
 * 2 zone (Trento Storica, Doss Trento) + 8 quest secondarie distribuite
 * con mix realistico di stati. Coordinate di punti di interesse reali
 * di Trento. Vedi commento sulle costanti per dettagli.
 */
@Injectable()
export class MockQuestRepository extends QuestRepository {
  // Latenza simulata per imitare una richiesta HTTP reale.
  // 250ms = veloce ma percepibile (utile per testare loading state).
  private readonly MOCK_LATENCY_MS = 250;

  // ----------------------------------------------------------------
  // API pubblica del repository
  // ----------------------------------------------------------------

  override getZones(): Observable<Zone[]> {
    return of(this.zones).pipe(delay(this.MOCK_LATENCY_MS));
  }

  override getQuestsInBounds(bounds?: GeoBounds): Observable<Quest[]> {
    // Filtra solo le quest dentro il bounding box se fornito.
    // Nel mock tutte le quest sono a Trento, quindi quasi sempre passeranno.
    const filtered = bounds
      ? this.quests.filter((q) => this.isWithinBounds(q.position, bounds))
      : this.quests;

    return of(filtered).pipe(
      delay(this.MOCK_LATENCY_MS),
      // Restituiamo una copia per evitare che chi consuma muti l'array interno.
      // In produzione HTTP questo e' naturale (ogni request e' un nuovo oggetto).
      map((quests) => quests.map((q) => ({ ...q }))),
    );
  }

  override markAsDiscovered(questId: string): Observable<Quest> {
    const quest = this.quests.find((q) => q.id === questId);

    if (!quest) {
      return throwError(() => new Error(`Quest non trovata: ${questId}`));
    }

    if (quest.status === 'locked') {
      return throwError(
        () => new Error(`Quest bloccata, non puo' essere scoperta: ${questId}`),
      );
    }

    // Muta lo stato in memoria. In produzione questo sara' fatto dal backend.
    quest.status = 'discovered';

    return of({ ...quest }).pipe(delay(this.MOCK_LATENCY_MS));
  }

  // ----------------------------------------------------------------
  // Utility interne
  // ----------------------------------------------------------------

  /** Test inclusione punto in bounding box. */
  private isWithinBounds(
    pos: { lat: number; lng: number },
    bounds: GeoBounds,
  ): boolean {
    return (
      pos.lat >= bounds.southWest.lat &&
      pos.lat <= bounds.northEast.lat &&
      pos.lng >= bounds.southWest.lng &&
      pos.lng <= bounds.northEast.lng
    );
  }

  // ================================================================
  // DATI MOCK
  // ================================================================
  // Hardcoded in-memory. Coordinate reali di punti di interesse di
  // Trento. Mix di stati per testare visivamente la mappa.
  //
  // QUANDO RIMUOVERE: insieme all'intera classe MockQuestRepository,
  // quando il backend sara' pronto e si passera' a HttpQuestRepository.
  // ================================================================

  private readonly zones: Zone[] = [
    {
      id: 'zone-trento-storica',
      name: 'Trento Storica',
      description:
        "Il cuore antico della citta'. Tra il Castello del Buonconsiglio " +
        'e Piazza Duomo si concentrano secoli di storia trentina.',
      center: { lat: 46.0689, lng: 11.1217 },
      radiusMeters: 450,
    },
    {
      id: 'zone-doss-trento',
      name: 'Doss Trento',
      description:
        "Il colle che domina la citta'. Vista panoramica, archeologia " +
        'romana e il Mausoleo di Cesare Battisti.',
      center: { lat: 46.0741, lng: 11.1124 },
      radiusMeters: 280,
    },
  ];

  private readonly quests: Quest[] = [
    // --- Zona Trento Storica ---
    {
      id: 'q-duomo',
      name: 'Cattedrale di San Vigilio',
      description:
        'La cattedrale romanico-gotica simbolo della citta\'. Cerca il ' +
        'leone di San Marco scolpito sul portale.',
      position: { lat: 46.0667, lng: 11.1211 },
      status: 'discovered' satisfies QuestStatus,
      category: 'monument' satisfies QuestCategory,
      zoneId: 'zone-trento-storica',
      points: 50,
    },
    {
      id: 'q-fontana-nettuno',
      name: 'Fontana del Nettuno',
      description:
        'Il dio del mare al centro di una citta\' di montagna. Settecento ' +
        'in piazza Duomo.',
      position: { lat: 46.0666, lng: 11.1213 },
      status: 'discovered',
      category: 'tradition',
      zoneId: 'zone-trento-storica',
      points: 30,
    },
    {
      id: 'q-buonconsiglio',
      name: 'Castello del Buonconsiglio',
      description:
        'Residenza dei principi vescovi. Affreschi, torri e secoli di ' +
        'potere temporale.',
      position: { lat: 46.0727, lng: 11.1239 },
      status: 'available',
      category: 'monument',
      zoneId: 'zone-trento-storica',
      points: 80,
    },
    {
      id: 'q-via-belenzani',
      name: 'Via Belenzani',
      description:
        'La via dei palazzi affrescati. Ogni facciata e\' una pagina di ' +
        'storia rinascimentale.',
      position: { lat: 46.0683, lng: 11.1217 },
      status: 'available',
      category: 'culture',
      zoneId: 'zone-trento-storica',
      points: 40,
    },
    {
      id: 'q-torre-vanga',
      name: 'Torre Vanga',
      description:
        'Antica torre di guardia medievale, oggi sede di mostre temporanee.',
      position: { lat: 46.0709, lng: 11.1183 },
      status: 'available',
      category: 'monument',
      zoneId: 'zone-trento-storica',
      points: 45,
    },
    {
      id: 'q-mercato-vigilio',
      name: 'Bottega del Casaro',
      description:
        'Piccola bottega storica vicino al mercato. Trentingrana stagionato ' +
        '24 mesi.',
      position: { lat: 46.0676, lng: 11.1197 },
      status: 'locked',
      category: 'food',
      zoneId: 'zone-trento-storica',
      points: 25,
    },

    // --- Zona Doss Trento ---
    {
      id: 'q-mausoleo',
      name: 'Mausoleo di Cesare Battisti',
      description:
        'Monumento funebre eretto in cima al Doss. Vista sull\'intera ' +
        "Valle dell'Adige.",
      position: { lat: 46.0741, lng: 11.1116 },
      status: 'discovered',
      category: 'monument',
      zoneId: 'zone-doss-trento',
      points: 60,
    },
    {
      id: 'q-belvedere-doss',
      name: 'Belvedere del Doss',
      description:
        'Il punto panoramico piu\' classico. All\'alba la luce taglia ' +
        "orizzontalmente la citta' sottostante.",
      position: { lat: 46.0739, lng: 11.1131 },
      status: 'available',
      category: 'nature',
      zoneId: 'zone-doss-trento',
      points: 35,
    },
  ];
}