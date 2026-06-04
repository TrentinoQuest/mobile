import {
  AfterViewInit,
  ApplicationRef,
  Component,
  ComponentRef,
  ElementRef,
  EnvironmentInjector,
  OnDestroy,
  ViewChild,
  computed,
  createComponent,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular/standalone';
import maplibregl from 'maplibre-gl';
import { ScanModalComponent } from '../components/scan-modal/scan-modal.component';
import { QuestService } from '../../../core/services/quest/quest.service';
import { GeolocationService } from '../../../core/services/geolocation/geolocation.service';
import { getQuestIcon } from '../../../core/services/quest/quest-icons';
import {
  AnyQuest,
  PrimaryQuest,
  QuestType,
  SecondaryQuest,
} from '../../../core/services/quest/quest.types';
import { QuestPopupComponent } from '../components/quest-popup/quest-popup.component';
import { HomeHeaderComponent } from '../components/home-header/home-header.component';
import { PermissionBannerComponent } from '../../../shared/components/permission-banner/permission banner.component';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { buildGameMapStyle } from '../../../core/services/map/map-style';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { HeadingService } from '../../../core/services/heading/heading.service';
import { MapSettingsService } from '../../../core/services/map/map-settings.service';

type PlayerStatus = ReturnType<QuestService['playerStatusOf']>;

/**
 * Struttura GeoJSON minima per FeatureCollection di poligoni.
 * Usata per i cerchi quest e il cerchio di incertezza GPS.
 */
interface CircleCollection {
  type: 'FeatureCollection';
  features: CircleFeature[];
}

interface CircleFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

/**
 * Home Giocatore — vista principale mappa-centrica.
 *
 * Rendering mappa via MapLibre GL JS con tile vettoriali OpenFreeMap e stile
 * di gioco custom (core/services/map/map-style.ts): camera pitchata 3D, edifici
 * estrusi, atmosfera. Dark cinematografico ↔ light caldo via ThemeService.
 *
 * Architettura dati:
 * - PrimaryQuest → cerchio GeoJSON (fill + line layer) + pin HTML Marker
 * - SecondaryQuest → pin HTML Marker puntuale
 * - Cluster (zoom < 13) → bolla HTML Marker aggregata
 * - Posizione utente → HTML Marker + cerchio incertezza GeoJSON
 *
 * Popup: QuestPopupComponent creato dinamicamente e montato via setDOMContent().
 * Un solo popup attivo alla volta; il componente Angular viene distrutto al close.
 *
 * Cambio tema: effect() chiama map.setStyle() → 'style.load' ri-aggiunge
 * sorgenti GeoJSON e layer (i marker HTML sopravvivono a setStyle).
 *
 * TODO 2F: gestire click su quest -> navigate(Quest Detail).
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, HomeHeaderComponent, PermissionBannerComponent],
})
export class HomePage implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  protected readonly QuestType = QuestType;

  // ----------------------------------------------------------------
  // Dependency injection
  // ----------------------------------------------------------------

  private readonly questService = inject(QuestService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly appRef = inject(ApplicationRef);
  private readonly modalCtrl = inject(ModalController);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly themeService = inject(ThemeService);
  private readonly haptics = inject(HapticsService);
  private readonly headingService = inject(HeadingService);
  private readonly mapSettings = inject(MapSettingsService);

  // ----------------------------------------------------------------
  // Stato interno MapLibre
  // ----------------------------------------------------------------

  private map: maplibregl.Map | null = null;
  private userMarker: maplibregl.Marker | null = null;

  /** Tutti i marker quest attivi: svuotati e ricreati ad ogni renderQuests(). */
  private allActiveQuestMarkers: maplibregl.Marker[] = [];

  /** Mappa questId → Marker per le secondary quest (usata da openToastAction). */
  private readonly questMarkers = new Map<string, maplibregl.Marker>();

  /** Popup MapLibre aperto correntemente (uno solo alla volta). */
  private activePopup: maplibregl.Popup | null = null;
  private activePopupRef: ComponentRef<QuestPopupComponent> | null = null;

  /**
   * Flag one-shot per l'auto-center al primo fix GPS valido di sessione.
   * Resettato a false in ngAfterViewInit (back nav → nuovo auto-center).
   */
  private hasAutoCentered = false;

  /** Intervallo per il refresh periodico quests + completions. */
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private readonly REFRESH_INTERVAL_MS = 30_000;

  // ----------------------------------------------------------------
  // Dati GeoJSON persistenti (sopravvivono a setStyle per tema)
  // ----------------------------------------------------------------

  private primaryCirclesData: CircleCollection = { type: 'FeatureCollection', features: [] };
  private uncertaintyCircleData: CircleCollection = { type: 'FeatureCollection', features: [] };

  // ----------------------------------------------------------------
  // Prossimita' (solo feedback aptico — la guida visiva e' l'HUD obiettivo)
  // ----------------------------------------------------------------

  /** Ultima quest che ha gia' fatto scattare l'alert di prossimita' (dedup). */
  private lastProximityQuestId: string | null = null;

  // ----------------------------------------------------------------
  // Stato camera (bussola) e obiettivo corrente
  // ----------------------------------------------------------------

  /** Angolo bussola in gradi = -bearing della mappa. Aggiornato su 'rotate'. */
  protected readonly compassAngle = signal(0);

  /** Ultimo heading bussola (gradi) applicato al cono direzione dell'utente. */
  private userHeading: number | null = null;
  /** Timestamp dell'ultima rotazione mappa guidata dalla bussola (throttle). */
  private lastHeadingRotateTs = 0;

  /**
   * Obiettivo corrente — la quest disponibile piu' vicina al giocatore.
   * E' il cuore del "cosa fare ora": l'HUD lo mostra sempre, cosi' chi apre
   * l'app sa subito dove andare. null se non ci sono quest disponibili.
   */
  protected readonly objective = computed(() => {
    // Lo status dipende dai completamenti: dichiariamo la dipendenza.
    this.questService.completions();
    const quests = this.questService.quests();
    const pos = this.geolocationService.position();

    const available = quests
      .filter((q) => this.questService.playerStatusOf(q.id) === 'available')
      .map((q) => {
        const isPrimary = q.type === QuestType.PRIMARY;
        const lat = isPrimary
          ? (q as PrimaryQuest).searchArea.lat
          : (q as SecondaryQuest).position.lat;
        const lng = isPrimary
          ? (q as PrimaryQuest).searchArea.lng
          : (q as SecondaryQuest).position.lng;
        const radius = isPrimary
          ? (q as PrimaryQuest).searchRadiusMeters
          : (q as SecondaryQuest).checkInRadiusMeters;
        return { quest: q, lat, lng, radius };
      });

    if (available.length === 0) return null;

    // Senza GPS non possiamo ordinare per distanza: mostriamo la prima.
    if (!pos) {
      const f = available[0];
      return {
        quest: f.quest,
        type: f.quest.type,
        distance: null as number | null,
        inRange: false,
        lat: f.lat,
        lng: f.lng,
      };
    }

    let best = available[0];
    let bestDist = Infinity;
    for (const c of available) {
      const d = haversineMeters(pos.lat, pos.lng, c.lat, c.lng);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return {
      quest: best.quest,
      type: best.quest.type,
      distance: Math.round(bestDist),
      inRange: bestDist <= best.radius,
      lat: best.lat,
      lng: best.lng,
    };
  });

  // ----------------------------------------------------------------
  // Costanti di configurazione mappa
  // ----------------------------------------------------------------

  /** Trento centro. MapLibre usa [lng, lat] (ordine GeoJSON). */
  private readonly INITIAL_CENTER: [number, number] = [11.1167, 46.0667];
  private readonly INITIAL_ZOOM = 15.5;
  private readonly USER_FOCUS_ZOOM = 17;
  /** Zoom dell'auto-centramento al primo fix: piu' ravvicinato, "sul personaggio". */
  private readonly AUTO_CENTER_ZOOM = 17.8;
  private readonly MIN_ZOOM = 9;
  private readonly MAX_ZOOM = 19;

  /** Inclinazione camera: la chiave dell'effetto "campo da gioco" 3D. */
  private readonly INITIAL_PITCH = 52;
  private readonly MAX_PITCH = 68;

  /** Bounds Trentino: [[lng_SW, lat_SW], [lng_NE, lat_NE]]. */
  private readonly TRENTINO_BOUNDS: [[number, number], [number, number]] = [
    [10.4, 45.6],
    [12.0, 46.6],
  ];

  private readonly CLUSTER_ZOOM_THRESHOLD = 13;
  private readonly CLUSTER_GRID_PX = 70;
  private readonly ACCURACY_THRESHOLD_METERS = 50;

  // ID sorgenti e layer GeoJSON
  private readonly SOURCE_PRIMARY = 'tq-primary-circles';
  private readonly SOURCE_UNCERTAINTY = 'tq-uncertainty';
  private readonly LAYER_PRIMARY_FILL = 'tq-primary-fill';
  private readonly LAYER_PRIMARY_LINE_SOLID = 'tq-primary-line-solid';
  private readonly LAYER_PRIMARY_LINE_DASHED = 'tq-primary-line-dashed';
  private readonly LAYER_UNCERTAINTY_FILL = 'tq-uncertainty-fill';
  private readonly LAYER_UNCERTAINTY_LINE = 'tq-uncertainty-line';

  // ----------------------------------------------------------------
  // Effects reattivi sui dati
  // ----------------------------------------------------------------

  constructor() {
    // Effect: re-render marker quando quests() o completions() cambiano.
    effect(() => {
      const quests = this.questService.quests();
      this.questService.completions();
      this.renderQuests(quests);
    });

    // Effect: sincronizza marker user, alone incertezza e proximity toast.
    effect(() => {
      const position = this.geolocationService.position();
      if (position) {
        this.syncUserGpsLayers(position.lat, position.lng, position.accuracy);
        this.checkProximity(position.lat, position.lng);
      }
    });

    // Effect: cambio tema → ricarica lo stile di gioco nella modalita' giusta.
    // setStyle preserva camera e marker DOM; onStyleLoad ri-aggiunge le sorgenti
    // GeoJSON custom. Al primo run la mappa non esiste ancora → no-op.
    effect(() => {
      const mode = this.themeService.effectiveTheme();
      if (this.map) {
        this.map.setStyle(buildGameMapStyle(mode));
      }
    });

    // Effect: heading bussola → orienta il cono direzione del giocatore e, se
    // attivo nelle impostazioni, ruota la mappa in modalita' "in avanti".
    effect(() => {
      const heading = this.headingService.heading();
      const rotate = this.mapSettings.rotateWithHeading();
      if (heading == null) return;
      this.userHeading = heading;
      this.updateUserHeadingVisual();

      // Rotazione mappa throttlata: evita una raffica di easeTo a ogni evento.
      if (rotate && this.map) {
        const now = Date.now();
        if (now - this.lastHeadingRotateTs > 120) {
          this.lastHeadingRotateTs = now;
          this.map.easeTo({ bearing: heading, duration: 220 });
        }
      }
    });

    // Effect: disattivando la rotazione bussola, riporta dolcemente a nord.
    effect(() => {
      const rotate = this.mapSettings.rotateWithHeading();
      if (!rotate && this.map) {
        this.map.easeTo({ bearing: 0, duration: 400 });
      }
    });
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  ngAfterViewInit(): void {
    this.initMap();
    this.hasAutoCentered = false;

    this.questService.loadQuests();
    this.questService.loadCompletions();

    this.refreshInterval = setInterval(() => {
      this.questService.loadQuests(undefined, true);
      this.questService.loadCompletions(undefined, undefined, true);
    }, this.REFRESH_INTERVAL_MS);
  }

  ionViewWillEnter(): void {
    // resize() equivalente di Leaflet invalidateSize(): ricalcola il container.
    setTimeout(() => this.map?.resize(), 100);
    this.questService.loadQuests(undefined, true);
    this.questService.loadCompletions(undefined, undefined, true);
    // Avvia la bussola per il cono direzione (best-effort: su iOS senza gesto
    // il permesso puo' negarsi, ma il toggle nelle impostazioni lo concede).
    void this.headingService.start();
  }

  ionViewWillLeave(): void {
    // Ferma il sensore bussola quando lasci la mappa: niente spreco batteria.
    this.headingService.stop();
  }

  ngOnDestroy(): void {
    if (this.refreshInterval !== null) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.headingService.stop();

    this.closeActivePopup();
    this.clearQuestMarkers();
    this.userMarker?.remove();
    this.userMarker = null;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  protected centerOnUser(): void {
    const pos = this.geolocationService.position();
    if (!pos || !this.map) return;
    this.haptics.medium();
    this.map.flyTo({
      center: [pos.lng, pos.lat],
      zoom: this.USER_FOCUS_ZOOM,
      pitch: this.INITIAL_PITCH,
      duration: 800,
    });
  }

  /** Bussola: riporta la camera a nord e al pitch di gioco. */
  protected resetNorth(): void {
    this.haptics.light();
    this.map?.easeTo({ bearing: 0, pitch: this.INITIAL_PITCH, duration: 500 });
  }

  /** Formatta una distanza in metri per l'HUD: "320 m" / "1.4 km". */
  protected formatDistance(meters: number | null): string {
    if (meters === null) return 'esplora la mappa';
    if (meters < 1000) return `a ${meters} m`;
    return `a ${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  }

  /**
   * CTA dell'obiettivo: se sei nel raggio avvia la quest (scan/check-in),
   * altrimenti vola verso di essa per guidarti.
   */
  protected async openObjectiveAction(): Promise<void> {
    const obj = this.objective();
    if (!obj) return;
    if (obj.inRange) {
      await this.startQuest(obj.quest.id, obj.type, [obj.lng, obj.lat]);
    } else {
      this.haptics.medium();
      this.map?.flyTo({
        center: [obj.lng, obj.lat],
        zoom: Math.max(this.map.getZoom(), this.USER_FOCUS_ZOOM),
        pitch: this.INITIAL_PITCH,
        duration: 900,
      });
    }
  }

  /**
   * Avvia una quest: primary → modale di scansione QR; secondary → vola sul
   * marker e ne apre il popup di check-in. Logica condivisa tra toast di
   * prossimita' e CTA dell'obiettivo.
   */
  private async startQuest(
    questId: string,
    type: QuestType,
    lngLat: [number, number] | null,
  ): Promise<void> {
    this.haptics.medium();

    if (type === QuestType.PRIMARY) {
      const modal = await this.modalCtrl.create({
        component: ScanModalComponent,
        cssClass: 'tq-scan-modal',
        backdropDismiss: false,
        componentProps: { questId },
      });
      await modal.present();
      return;
    }

    if (lngLat && this.map) {
      this.map.flyTo({
        center: lngLat,
        zoom: Math.max(this.map.getZoom(), 16.5),
        duration: 600,
      });
      const quest = untracked(() => this.questService.quests()).find((q) => q.id === questId);
      if (quest) {
        setTimeout(() => {
          this.openQuestPopup(quest, this.questService.playerStatusOf(quest.id), lngLat);
        }, 650);
      }
    }
  }

  // ----------------------------------------------------------------
  // Inizializzazione mappa
  // ----------------------------------------------------------------

  private initMap(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: buildGameMapStyle(untracked(() => this.themeService.effectiveTheme())),
      center: this.INITIAL_CENTER,
      zoom: this.INITIAL_ZOOM,
      minZoom: this.MIN_ZOOM,
      maxZoom: this.MAX_ZOOM,
      pitch: this.INITIAL_PITCH,
      maxPitch: this.MAX_PITCH,
      maxBounds: this.TRENTINO_BOUNDS,
      // Crediti OpenFreeMap disattivati: la mappa e' il campo da gioco.
      // I crediti dati OSM/OpenFreeMap andranno in una sezione "crediti" dedicata.
      attributionControl: false,
      // Antialiasing per bordi 3D piu' puliti (MapLibre v5: dentro le ctx attrs).
      canvasContextAttributes: { antialias: true },
    });

    // Ogni volta che lo stile finisce di caricare (iniziale + setStyle per tema):
    // ri-aggiunge le sorgenti GeoJSON e i layer custom.
    this.map.on('style.load', () => this.onStyleLoad());

    // Zoom end: aggiorna clustering.
    this.map.on('zoomend', () => {
      this.renderQuests(untracked(() => this.questService.quests()));
    });

    // Rotazione camera: aggiorna la bussola HUD e tieni il cono direzione
    // dell'utente allineato al mondo (i marker non ruotano con la mappa).
    this.map.on('rotate', () => {
      if (!this.map) return;
      this.compassAngle.set(-this.map.getBearing());
      this.updateUserHeadingVisual();
    });

    // MapLibre misura il container durante la costruzione. Se il layout Ionic
    // non ha ancora calcolato le dimensioni, il canvas risulta 0×0.
    // resize() sul microtask successivo forza il recalcolo.
    setTimeout(() => this.map?.resize(), 0);
  }

  /**
   * Chiamato una volta sola quando lo stile MapLibre finisce di caricare.
   * Aggiunge le sorgenti GeoJSON e i layer custom, poi ri-renderizza se
   * il servizio ha già dati cachati (es. navigazione back).
   */
  private onStyleLoad(): void {
    this.addGeoJsonSourcesAndLayers();

    // Back-navigation: gli effect potrebbero aver già tentato renderQuests()
    // prima che lo stile fosse pronto (e aver restituito early). Forziamo
    // il re-render con i dati già in memoria.
    const quests = untracked(() => this.questService.quests());
    if (quests.length > 0) {
      this.renderQuests(quests);
    }

    const pos = untracked(() => this.geolocationService.position());
    if (pos) {
      this.syncUserGpsLayers(pos.lat, pos.lng, pos.accuracy);
    }

    setTimeout(() => this.map?.resize(), 0);
  }

  // ----------------------------------------------------------------
  // Sorgenti e layer GeoJSON
  // ----------------------------------------------------------------

  private addGeoJsonSourcesAndLayers(): void {
    if (!this.map) return;

    this.map.addSource(this.SOURCE_PRIMARY, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // Fill semitrasparente dei cerchi primary quest.
    this.map.addLayer({
      id: this.LAYER_PRIMARY_FILL,
      type: 'fill',
      source: this.SOURCE_PRIMARY,
      paint: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': ['get', 'fillOpacity'],
      },
    });

    // Bordo continuo (available quest).
    this.map.addLayer({
      id: this.LAYER_PRIMARY_LINE_SOLID,
      type: 'line',
      source: this.SOURCE_PRIMARY,
      filter: ['!', ['get', 'dashed']],
      paint: {
        'line-color': ['get', 'fillColor'],
        'line-opacity': ['get', 'lineOpacity'],
        'line-width': ['get', 'lineWeight'],
      },
    });

    // Bordo tratteggiato (discovered / locked).
    this.map.addLayer({
      id: this.LAYER_PRIMARY_LINE_DASHED,
      type: 'line',
      source: this.SOURCE_PRIMARY,
      filter: ['get', 'dashed'],
      paint: {
        'line-color': ['get', 'fillColor'],
        'line-opacity': ['get', 'lineOpacity'],
        'line-width': ['get', 'lineWeight'],
        'line-dasharray': [6, 8],
      },
    });

    // Click su cerchio → popup quest (uguale al pin).
    this.map.on('click', this.LAYER_PRIMARY_FILL, (e) => {
      if (!e.features?.length) return;
      const questId = e.features[0].properties?.['questId'] as string;
      const quest = untracked(() => this.questService.quests()).find((q) => q.id === questId);
      if (!quest) return;
      this.openQuestPopup(quest, this.questService.playerStatusOf(quest.id), [
        e.lngLat.lng,
        e.lngLat.lat,
      ]);
    });

    this.map.on('mouseenter', this.LAYER_PRIMARY_FILL, () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', this.LAYER_PRIMARY_FILL, () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });

    // Cerchio di incertezza GPS.
    this.map.addSource(this.SOURCE_UNCERTAINTY, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    this.map.addLayer({
      id: this.LAYER_UNCERTAINTY_FILL,
      type: 'fill',
      source: this.SOURCE_UNCERTAINTY,
      paint: {
        'fill-color': 'rgba(184, 134, 11, 1)',
        'fill-opacity': 0.12,
      },
    });

    this.map.addLayer({
      id: this.LAYER_UNCERTAINTY_LINE,
      type: 'line',
      source: this.SOURCE_UNCERTAINTY,
      paint: {
        'line-color': 'rgba(184, 134, 11, 0.4)',
        'line-width': 1,
      },
    });
  }

  // ----------------------------------------------------------------
  // Rendering quest (reattivo)
  // ----------------------------------------------------------------

  private renderQuests(quests: AnyQuest[]): void {
    if (!this.map || !this.map.getSource(this.SOURCE_PRIMARY)) return;

    this.clearQuestMarkers();
    this.updatePrimaryCirclesSource(quests);

    if (this.map.getZoom() < this.CLUSTER_ZOOM_THRESHOLD) {
      this.renderWithClustering(quests);
    } else {
      this.renderFlat(quests);
    }
  }

  private clearQuestMarkers(): void {
    for (const marker of this.allActiveQuestMarkers) {
      marker.remove();
    }
    this.allActiveQuestMarkers = [];
    this.questMarkers.clear();
  }

  private updatePrimaryCirclesSource(quests: AnyQuest[]): void {
    this.primaryCirclesData = {
      type: 'FeatureCollection',
      features: quests
        .filter((q) => q.type === QuestType.PRIMARY)
        .map((q) => this.buildPrimaryCircleFeature(q as PrimaryQuest)),
    };
    (this.map?.getSource(this.SOURCE_PRIMARY) as maplibregl.GeoJSONSource | undefined)?.setData(
      this.primaryCirclesData,
    );
  }

  private buildPrimaryCircleFeature(quest: PrimaryQuest): CircleFeature {
    const playerStatus = this.questService.playerStatusOf(quest.id);
    const fillColor =
      playerStatus === 'discovered' ? '#6BA046' : playerStatus === 'locked' ? '#666666' : '#C8930F';
    const isAvailable = playerStatus === 'available';
    const isDiscovered = playerStatus === 'discovered';

    return {
      type: 'Feature',
      properties: {
        questId: quest.id,
        fillColor,
        fillOpacity: isAvailable ? 0.2 : isDiscovered ? 0.06 : 0.05,
        lineOpacity: isAvailable ? 1.0 : isDiscovered ? 0.35 : 0.25,
        lineWeight: isAvailable ? 3 : 1.5,
        dashed: !isAvailable,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          buildCirclePolygon(quest.searchArea.lat, quest.searchArea.lng, quest.searchRadiusMeters),
        ],
      },
    };
  }

  /** Render non-clustered: un marker per ogni quest. */
  private renderFlat(quests: AnyQuest[]): void {
    quests.forEach((quest, i) => this.addQuestMarker(quest, i));
  }

  /**
   * Render con clustering grid-based.
   * Usa map.project([lng, lat]) per convertire coordinate in pixel.
   */
  private renderWithClustering(quests: AnyQuest[]): void {
    const gridSize = this.CLUSTER_GRID_PX;

    const items = quests.map((quest) => {
      const lat =
        quest.type === QuestType.PRIMARY
          ? (quest as PrimaryQuest).searchArea.lat
          : (quest as SecondaryQuest).position.lat;
      const lng =
        quest.type === QuestType.PRIMARY
          ? (quest as PrimaryQuest).searchArea.lng
          : (quest as SecondaryQuest).position.lng;
      return { quest, lat, lng };
    });

    const cells = new Map<string, { quest: AnyQuest; lat: number; lng: number }[]>();
    for (const item of items) {
      // MapLibre: project([lng, lat]) → {x, y} in pixel
      const pixel = this.map!.project([item.lng, item.lat]);
      const key = `${Math.floor(pixel.x / gridSize)},${Math.floor(pixel.y / gridSize)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(item);
    }

    let staggerIndex = 0;
    for (const [, group] of cells) {
      if (group.length === 1) {
        this.addQuestMarker(group[0].quest, staggerIndex++);
      } else {
        const avgLat = group.reduce((s, item) => s + item.lat, 0) / group.length;
        const avgLng = group.reduce((s, item) => s + item.lng, 0) / group.length;
        this.addClusterMarker(avgLat, avgLng, group.length, staggerIndex++);
      }
    }
  }

  /**
   * Crea un marker HTML per una quest e lo aggiunge alla mappa.
   * MapLibre.Marker gestisce il posizionamento; l'elemento DOM è nostro.
   */
  private addQuestMarker(quest: AnyQuest, staggerIndex: number): void {
    const isPrimary = quest.type === QuestType.PRIMARY;
    const lat = isPrimary
      ? (quest as PrimaryQuest).searchArea.lat
      : (quest as SecondaryQuest).position.lat;
    const lng = isPrimary
      ? (quest as PrimaryQuest).searchArea.lng
      : (quest as SecondaryQuest).position.lng;
    const playerStatus = this.questService.playerStatusOf(quest.id);
    const iconSvg = getQuestIcon(quest, playerStatus);

    const el = document.createElement('div');
    el.className = 'quest-marker-wrapper';
    el.innerHTML = `
      <div class="quest-marker${isPrimary ? ' quest-marker--primary' : ''} quest-marker--${playerStatus}">
        <div class="quest-marker__shadow"></div>
        <div class="quest-marker__body">
          <div class="quest-marker__pin">${iconSvg}</div>
        </div>
      </div>
    `;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.haptics.light();
      this.openQuestPopup(quest, playerStatus, [lng, lat]);
    });

    setTimeout(() => {
      el.style.setProperty('--stagger-delay', `${staggerIndex * 65}ms`);
      el.classList.add('quest-marker-wrapper--enter');
    }, 0);

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(this.map!);

    this.allActiveQuestMarkers.push(marker);
    if (quest.type === QuestType.SECONDARY) {
      this.questMarkers.set(quest.id, marker);
    }
  }

  /**
   * Crea una bolla cluster che aggrega più quest nella stessa cella della griglia.
   */
  private addClusterMarker(lat: number, lng: number, count: number, staggerIndex: number): void {
    const el = document.createElement('div');
    el.className = 'quest-cluster-wrapper';
    el.innerHTML = `
      <div class="quest-cluster">
        <div class="quest-marker__shadow"></div>
        <div class="quest-cluster__body">
          <span class="quest-cluster__count">${count}</span>
        </div>
      </div>
    `;

    setTimeout(() => {
      el.style.setProperty('--stagger-delay', `${staggerIndex * 65}ms`);
      el.classList.add('quest-marker-wrapper--enter');
    }, 0);

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(this.map!);

    this.allActiveQuestMarkers.push(marker);
  }

  // ----------------------------------------------------------------
  // Popup (componente Angular dentro MapLibre Popup)
  // ----------------------------------------------------------------

  /**
   * Apre un popup con QuestPopupComponent montato dinamicamente.
   * Chiude e distrugge il popup precedente se già aperto.
   */
  private openQuestPopup(quest: AnyQuest, status: PlayerStatus, lngLat: [number, number]): void {
    this.closeActivePopup();

    const ref = this.createPopupForQuest(quest, status);
    ref.changeDetectorRef.detectChanges();

    this.activePopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      className: 'tq-quest-popup',
      maxWidth: 'none',
    })
      .setLngLat(lngLat)
      .setDOMContent(ref.location.nativeElement)
      .addTo(this.map!);

    this.activePopupRef = ref;

    // Distrugge il ComponentRef Angular al close del popup Leaflet.
    this.activePopup.once('close', () => {
      ref.destroy();
      this.activePopup = null;
      this.activePopupRef = null;
    });
  }

  private closeActivePopup(): void {
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }
    if (this.activePopupRef) {
      this.activePopupRef.destroy();
      this.activePopupRef = null;
    }
  }

  private createPopupForQuest(
    quest: AnyQuest,
    status: PlayerStatus,
  ): ComponentRef<QuestPopupComponent> {
    const ref = createComponent(QuestPopupComponent, { environmentInjector: this.envInjector });
    ref.setInput('questData', quest);
    ref.setInput('status', status);
    this.appRef.attachView(ref.hostView);
    return ref;
  }

  // ----------------------------------------------------------------
  // User GPS layers (marker + alone incertezza)
  // ----------------------------------------------------------------

  /**
   * Sincronizza marker user e cerchio di incertezza con la posizione GPS.
   * Idempotente: crea i layer la prima volta, aggiorna alle chiamate successive.
   * Auto-center one-shot al primo fix GPS valido della sessione.
   */
  private syncUserGpsLayers(lat: number, lng: number, accuracy: number): void {
    if (!this.map) return;

    // 1. Marker user — crea la prima volta, aggiorna le successive.
    //    Struttura: cono direzione (ruota con la bussola) + alone pulsante +
    //    dot centrale. Stile allineato alla mappa dark (ocra luminoso + glow).
    if (this.userMarker === null) {
      const el = document.createElement('div');
      el.className = 'user-marker-wrapper';
      el.innerHTML = `
        <div class="user-marker">
          <div class="user-marker__cone"></div>
          <div class="user-marker__pulse"></div>
          <div class="user-marker__dot"></div>
        </div>
      `;
      this.userMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map);
      // Applica subito l'eventuale heading gia' noto.
      this.updateUserHeadingVisual();
    } else {
      this.userMarker.setLngLat([lng, lat]);
    }

    // 2. Cerchio di incertezza — visibile solo se accuracy supera la soglia.
    if (accuracy > this.ACCURACY_THRESHOLD_METERS) {
      this.uncertaintyCircleData = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [buildCirclePolygon(lat, lng, accuracy)],
            },
          },
        ],
      };
    } else {
      this.uncertaintyCircleData = { type: 'FeatureCollection', features: [] };
    }
    (this.map.getSource(this.SOURCE_UNCERTAINTY) as maplibregl.GeoJSONSource | undefined)?.setData(
      this.uncertaintyCircleData,
    );

    // 3. Auto-center one-shot al primo fix valido della sessione.
    //    Zoom ravvicinato (AUTO_CENTER_ZOOM) per "atterrare" sul personaggio.
    if (!this.hasAutoCentered) {
      this.map.flyTo({
        center: [lng, lat],
        zoom: this.AUTO_CENTER_ZOOM,
        pitch: this.INITIAL_PITCH,
        duration: 1500,
      });
      this.hasAutoCentered = true;
    }
  }

  /**
   * Orienta il cono di direzione del marker utente verso il punto in cui sta
   * puntando il telefono. Il cono e' in spazio-schermo (i marker MapLibre non
   * ruotano con la mappa), quindi compensiamo il bearing: angolo = heading −
   * bearing. Cosi' in modalita' "nord in alto" il cono ruota col telefono, e
   * in modalita' "rotazione bussola" resta dritto verso l'alto.
   */
  private updateUserHeadingVisual(): void {
    if (!this.userMarker || this.userHeading == null || !this.map) return;
    const cone = this.userMarker.getElement().querySelector<HTMLElement>('.user-marker__cone');
    if (!cone) return;
    const screenAngle = this.userHeading - this.map.getBearing();
    cone.style.transform = `rotate(${screenAngle}deg)`;
    cone.style.opacity = '1';
  }

  // ----------------------------------------------------------------
  // Prossimita' — alert aptico all'ingresso nel raggio di una quest
  // ----------------------------------------------------------------

  /**
   * Controlla se il giocatore e' entrato nel raggio di trigger di una quest
   * disponibile e, in tal caso, emette feedback aptico (marcato se gia' nel
   * raggio di azione, leggero se in avvicinamento). La guida visiva resta
   * all'HUD obiettivo persistente: qui solo il "tocco" tattile del momento.
   */
  private checkProximity(lat: number, lng: number): void {
    const quests = untracked(() => this.questService.quests());
    for (const quest of quests) {
      if (this.questService.playerStatusOf(quest.id) !== 'available') continue;

      let questLat: number, questLng: number, triggerRange: number, inRangeRadius: number;
      if (quest.type === QuestType.PRIMARY) {
        const q = quest as PrimaryQuest;
        questLat = q.searchArea.lat;
        questLng = q.searchArea.lng;
        inRangeRadius = q.searchRadiusMeters;
        triggerRange = q.searchRadiusMeters * 2.5;
      } else {
        const q = quest as SecondaryQuest;
        questLat = q.position.lat;
        questLng = q.position.lng;
        inRangeRadius = q.checkInRadiusMeters;
        triggerRange = q.checkInRadiusMeters * 2.5;
      }

      const dist = haversineMeters(lat, lng, questLat, questLng);
      if (dist <= triggerRange && quest.id !== this.lastProximityQuestId) {
        this.lastProximityQuestId = quest.id;
        if (dist <= inRangeRadius) this.haptics.warning();
        else this.haptics.light();
        break;
      }
    }
  }
}

// ----------------------------------------------------------------
// Utility pure (fuori dalla classe, nessun side effect)
// ----------------------------------------------------------------

/**
 * Approssima un cerchio geografico come poligono GeoJSON (ring chiuso).
 * Coordine in ordine [lng, lat] — standard GeoJSON / MapLibre.
 */
function buildCirclePolygon(
  lat: number,
  lng: number,
  radiusMeters: number,
  steps = 64,
): number[][] {
  const coords: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    const dLat = (radiusMeters * Math.cos(angle)) / 110540;
    const dLng = (radiusMeters * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
    coords.push([lng + dLng, lat + dLat]);
  }
  return coords;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
