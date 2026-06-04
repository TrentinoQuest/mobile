import {
  AfterViewInit,
  ApplicationRef,
  Component,
  ComponentRef,
  ElementRef,
  EnvironmentInjector,
  OnDestroy,
  ViewChild,
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
 * Rendering mappa via MapLibre GL JS con tile vettoriali OpenFreeMap.
 * Stile adattivo: liberty (light) ↔ fiord (dark), sincronizzato con ThemeService.
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
  // Proximity toast
  // ----------------------------------------------------------------

  protected readonly proximityToast = signal<{
    questId: string;
    questName: string;
    inRange: boolean;
    type: QuestType;
  } | null>(null);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private lastToastQuestId: string | null = null;

  // ----------------------------------------------------------------
  // Costanti di configurazione mappa
  // ----------------------------------------------------------------

  /** Trento centro. MapLibre usa [lng, lat] (ordine GeoJSON). */
  private readonly INITIAL_CENTER: [number, number] = [11.1167, 46.0667];
  private readonly INITIAL_ZOOM = 14;
  private readonly USER_FOCUS_ZOOM = 16;
  private readonly MIN_ZOOM = 9;
  private readonly MAX_ZOOM = 18;
  /** Bounds Trentino: [[lng_SW, lat_SW], [lng_NE, lat_NE]]. */
  private readonly TRENTINO_BOUNDS: [[number, number], [number, number]] = [
    [10.4, 45.6],
    [12.0, 46.6],
  ];

  /** Stile OpenFreeMap liberty — unico per light e dark (il dark si adatta via CSS filter). */
  private readonly MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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

    // Nota: il tema dark/light è gestito via CSS filter su .maplibregl-canvas-container
    // in global.scss — non serve setStyle() perché si usa lo stesso stile liberty.
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
  }

  ngOnDestroy(): void {
    if (this.refreshInterval !== null) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

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
    this.map.flyTo({ center: [pos.lng, pos.lat], zoom: this.USER_FOCUS_ZOOM, duration: 800 });
  }

  protected dismissToast(): void {
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.proximityToast.set(null);
  }

  protected async openToastAction(): Promise<void> {
    const toast = this.proximityToast();
    if (!toast) return;
    this.dismissToast();

    if (toast.type === QuestType.PRIMARY) {
      const modal = await this.modalCtrl.create({
        component: ScanModalComponent,
        cssClass: 'tq-scan-modal',
        backdropDismiss: false,
        componentProps: { questId: toast.questId },
      });
      await modal.present();
    } else {
      const marker = this.questMarkers.get(toast.questId);
      if (marker && this.map) {
        const lngLat = marker.getLngLat();
        this.map.flyTo({
          center: [lngLat.lng, lngLat.lat],
          zoom: Math.max(this.map.getZoom(), 16),
          duration: 600,
        });
        const quest = untracked(() => this.questService.quests()).find(
          (q) => q.id === toast.questId,
        );
        if (quest) {
          setTimeout(() => {
            this.openQuestPopup(
              quest,
              this.questService.playerStatusOf(quest.id),
              [lngLat.lng, lngLat.lat],
            );
          }, 650);
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // Inizializzazione mappa
  // ----------------------------------------------------------------

  private initMap(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.MAP_STYLE,
      center: this.INITIAL_CENTER,
      zoom: this.INITIAL_ZOOM,
      minZoom: this.MIN_ZOOM,
      maxZoom: this.MAX_ZOOM,
      maxBounds: this.TRENTINO_BOUNDS,
      attributionControl: false,
    });

    // Attribution compatta posizionata sopra la tab bar (via CSS in home.page.scss).
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    // Ogni volta che lo stile finisce di caricare (iniziale + setStyle per tema):
    // ri-aggiunge le sorgenti GeoJSON e i layer custom.
    this.map.on('style.load', () => this.onStyleLoad());

    // Zoom end: aggiorna clustering.
    this.map.on('zoomend', () => {
      this.renderQuests(untracked(() => this.questService.quests()));
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.map?.getSource(this.SOURCE_PRIMARY) as any)?.setData(this.primaryCirclesData);
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
        <div class="quest-marker__pin">${iconSvg}</div>
      </div>
    `;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
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
        <span class="quest-cluster__count">${count}</span>
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
  private openQuestPopup(
    quest: AnyQuest,
    status: PlayerStatus,
    lngLat: [number, number],
  ): void {
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
    if (this.userMarker === null) {
      const el = document.createElement('div');
      el.className = 'user-marker-wrapper';
      el.innerHTML = `
        <div class="user-marker">
          <div class="user-marker__pulse"></div>
          <div class="user-marker__dot"></div>
        </div>
      `;
      this.userMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.map.getSource(this.SOURCE_UNCERTAINTY) as any)?.setData(this.uncertaintyCircleData);

    // 3. Auto-center one-shot al primo fix valido della sessione.
    if (!this.hasAutoCentered) {
      this.map.flyTo({ center: [lng, lat], zoom: this.USER_FOCUS_ZOOM, duration: 1500 });
      this.hasAutoCentered = true;
    }
  }

  // ----------------------------------------------------------------
  // Proximity toast
  // ----------------------------------------------------------------

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
      if (dist <= triggerRange && quest.id !== this.lastToastQuestId) {
        this.lastToastQuestId = quest.id;
        this.proximityToast.set({
          questId: quest.id,
          questName: quest.name,
          inRange: dist <= inRangeRadius,
          type: quest.type,
        });
        if (this.toastTimer !== null) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.proximityToast.set(null), 5500);
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
function buildCirclePolygon(lat: number, lng: number, radiusMeters: number, steps = 64): number[][] {
  const coords: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    const dLat = (radiusMeters * Math.cos(angle)) / 110540;
    const dLng =
      (radiusMeters * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
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
