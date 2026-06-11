import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { IonContent, IonIcon, IonModal, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { locateOutline, optionsOutline, listOutline } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import { ScanModalComponent } from '../components/scan-modal/scan-modal.component';
import { QuestDetailSheetComponent } from '../components/quest-detail-sheet/quest-detail-sheet.component';
import { QuestService } from '../../../core/services/quest/quest.service';
import { GeolocationService } from '../../../core/services/geolocation/geolocation.service';
import { registerQuestIcons } from '../../../core/services/map/quest-map-icons';
import { buildValleyClusters } from '../../../core/services/map/valley-clustering';
import {
  AnyQuest,
  PrimaryQuest,
  QuestType,
  SecondaryQuest,
} from '../../../core/services/quest/quest.types';
import { HomeHeaderComponent } from '../components/home-header/home-header.component';
import { PermissionBannerComponent } from '../../../shared/components/permission-banner/permission-banner.component';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { buildGameMapStyle } from '../../../core/services/map/map-style';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { HeadingService } from '../../../core/services/heading/heading.service';
import { MapSettingsService } from '../../../core/services/map/map-settings.service';
import { haversineMeters } from '../../../core/utils/geo';
import { TRENTINO_VALLEY_LINES } from './trentino-valley-lines.data';
import { TRENTINO_MASK } from './trentino-mask.data';

type PlayerStatus = ReturnType<QuestService['playerStatusOf']>;

/** Filtro mappa multi-flag. */
interface MapFilter {
  showPrimary: boolean;
  showSecondary: boolean;
  showCompleted: boolean;
}

/** Voce della lista "quest vicine" del bottom sheet. */
interface NearbyQuestItem {
  id: string;
  name: string;
  type: QuestType;
  status: PlayerStatus;
  distance: number | null;
  inRange: boolean;
  lat: number;
  lng: number;
}

interface CircleCollection {
  type: 'FeatureCollection';
  features: CircleFeature[];
}

interface CircleFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, IonModal, HomeHeaderComponent, PermissionBannerComponent],
})
export class HomePage implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  protected readonly QuestType = QuestType;

  private readonly questService = inject(QuestService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly modalCtrl = inject(ModalController);
  private readonly themeService = inject(ThemeService);
  private readonly haptics = inject(HapticsService);
  private readonly headingService = inject(HeadingService);
  private readonly mapSettings = inject(MapSettingsService);

  private map: maplibregl.Map | null = null;
  private userMarker: maplibregl.Marker | null = null;
  private hasAutoCentered = false;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private readonly REFRESH_INTERVAL_MS = 30_000;

  // Bottom sheet quest attiva
  private activeSheet: HTMLIonModalElement | null = null;

  private primaryCirclesData: CircleCollection = { type: 'FeatureCollection', features: [] };
  private uncertaintyCircleData: CircleCollection = { type: 'FeatureCollection', features: [] };

  private lastProximityQuestId: string | null = null;

  protected readonly compassAngle = signal(0);
  private userHeading: number | null = null;
  private lastHeadingRotateTs = 0;

  protected readonly nearbySheetOpen = signal(false);
  protected readonly showFilterPanel = signal(false);

  protected readonly mapFilter = signal<MapFilter>({
    showPrimary: true,
    showSecondary: true,
    showCompleted: false,
  });

  protected readonly objective = computed(() => {
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

  protected readonly nearbyItems = computed<NearbyQuestItem[]>(() => {
    this.questService.completions();
    const quests = this.questService.quests();
    const pos = this.geolocationService.position();

    const items: NearbyQuestItem[] = quests.map((q) => {
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
      const status = this.questService.playerStatusOf(q.id);
      const distance = pos ? Math.round(haversineMeters(pos.lat, pos.lng, lat, lng)) : null;
      return {
        id: q.id,
        name: q.name,
        type: q.type,
        status,
        distance,
        inRange: distance != null && distance <= radius,
        lat,
        lng,
      };
    });

    const rank = (s: PlayerStatus): number => (s === 'available' ? 0 : s === 'discovered' ? 1 : 2);
    return items.sort((a, b) => {
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  });

  protected readonly availableCount = computed<number>(
    () => this.nearbyItems().filter((i) => i.status === 'available').length,
  );

  private readonly INITIAL_CENTER: [number, number] = [11.1167, 46.0667];
  private readonly INITIAL_ZOOM = 15.5;
  private readonly USER_FOCUS_ZOOM = 17;
  private readonly AUTO_CENTER_ZOOM = 17.8;
  private readonly MIN_ZOOM = 6;
  private readonly MAX_ZOOM = 19;
  private readonly INITIAL_PITCH = 0;
  private readonly MAX_PITCH = 0;
  private readonly TRENTINO_BOUNDS: [[number, number], [number, number]] = [
    [9.5, 44.8],
    [12.8, 47.4],
  ];
  private readonly ACCURACY_THRESHOLD_METERS = 50;
  private readonly VALLEY_ZOOM_THRESHOLD = 10;
  private lastQuestClickMs = 0;

  private readonly SOURCE_QUESTS = 'tq-quests';
  private readonly LAYER_QUEST_POINTS = 'tq-quest-points';

  private readonly SOURCE_VALLEY_CLUSTERS = 'tq-valley-clusters';
  private readonly LAYER_VALLEY_CIRCLES = 'tq-valley-circles';
  private readonly LAYER_VALLEY_COUNT = 'tq-valley-count';

  private readonly SOURCE_PRIMARY = 'tq-primary-circles';
  private readonly SOURCE_UNCERTAINTY = 'tq-uncertainty';
  private readonly LAYER_PRIMARY_FILL = 'tq-primary-fill';
  private readonly LAYER_PRIMARY_LINE_SOLID = 'tq-primary-line-solid';
  private readonly LAYER_PRIMARY_LINE_DASHED = 'tq-primary-line-dashed';
  private readonly LAYER_UNCERTAINTY_FILL = 'tq-uncertainty-fill';
  private readonly LAYER_UNCERTAINTY_LINE = 'tq-uncertainty-line';

  private readonly SOURCE_TRENTINO_VALLEYS = 'tq-trentino-valleys';
  private readonly SOURCE_TRENTINO_MASK = 'tq-trentino-mask';
  private readonly LAYER_TRENTINO_MASK_FILL = 'tq-trentino-mask-fill';
  private readonly LAYER_TRENTINO_VALLEY_LINES = 'tq-trentino-valley-lines';

  constructor() {
    addIcons({ locateOutline, optionsOutline, listOutline });

    effect(() => {
      const quests = this.questService.quests();
      this.questService.completions();
      this.renderQuests(quests);
    });

    effect(() => {
      const position = this.geolocationService.position();
      if (position) {
        this.syncUserGpsLayers(position.lat, position.lng, position.accuracy);
        this.checkProximity(position.lat, position.lng);
      }
    });

    effect(() => {
      const mode = this.themeService.effectiveTheme();
      if (this.map) this.map.setStyle(buildGameMapStyle(mode));
    });

    effect(() => {
      const heading = this.headingService.heading();
      const rotate = this.mapSettings.rotateWithHeading();
      if (heading == null) return;
      this.userHeading = heading;
      this.updateUserHeadingVisual();
      if (rotate && this.map) {
        const now = Date.now();
        if (now - this.lastHeadingRotateTs > 120) {
          this.lastHeadingRotateTs = now;
          this.map.easeTo({ bearing: heading, duration: 220 });
        }
      }
    });

    effect(() => {
      const rotate = this.mapSettings.rotateWithHeading();
      if (!rotate && this.map) this.map.easeTo({ bearing: 0, duration: 400 });
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.hasAutoCentered = false;

    // Il layout giocatore usa un <router-outlet> Angular standard (non
    // ion-router-outlet, per evitare le transizioni slide di Ionic): gli
    // hook ionViewWillEnter/ionViewWillLeave NON scattano in questo shell.
    // Con IonicRouteStrategy + RouterOutlet standard la pagina viene
    // ricreata a ogni ingresso nella tab e distrutta all'uscita, quindi il
    // caricamento dati + polling vivono qui (ngAfterViewInit) e la pulizia
    // in ngOnDestroy. Spostare questa logica negli hook Ionic la
    // renderebbe morta: le quest non si caricherebbero all'apertura.
    setTimeout(() => this.map?.resize(), 100);
    this.questService.loadQuests(undefined, true);
    this.questService.loadCompletions(undefined, undefined, true);
    this.startPolling();
    // Su piattaforme senza permesso esplicito (rilevato via feature
    // detection) la bussola parte subito; dove serve un gesto utente
    // il prompt scattera' al primo tap sui controlli mappa.
    void this.headingService.start();
  }

  ngOnDestroy(): void {
    // Ferma il polling e la bussola: senza questo continuerebbero a girare
    // dopo aver lasciato la tab (la pagina viene distrutta dal RouterOutlet).
    this.stopPolling();
    this.headingService.stop();
    this.showFilterPanel.set(false);
    if (this.activeSheet) {
      void this.activeSheet.dismiss();
      this.activeSheet = null;
    }
    this.userMarker?.remove();
    this.userMarker = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private startPolling(): void {
    if (this.refreshInterval !== null) return;
    this.refreshInterval = setInterval(() => {
      this.questService.loadQuests(undefined, true);
      this.questService.loadCompletions(undefined, undefined, true);
    }, this.REFRESH_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.refreshInterval !== null) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  protected centerOnUser(): void {
    // Gesto utente: occasione per chiedere il permesso bussola dove
    // richiesto (DeviceOrientationEvent.requestPermission). Idempotente.
    void this.headingService.start();
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

  protected resetNorth(): void {
    // Gesto utente: vedi centerOnUser per il permesso bussola.
    void this.headingService.start();
    this.haptics.light();
    this.map?.easeTo({ bearing: 0, pitch: this.INITIAL_PITCH, duration: 500 });
  }

  protected openNearby(): void {
    this.haptics.light();
    this.nearbySheetOpen.set(true);
  }

  protected toggleFilterPanel(): void {
    void this.haptics.tapLight();
    this.showFilterPanel.update((v) => !v);
  }

  protected closeFilterPanel(): void {
    this.showFilterPanel.set(false);
  }

  protected toggleFilter(key: keyof MapFilter): void {
    void this.haptics.tapLight();
    this.mapFilter.update((f) => ({ ...f, [key]: !f[key] }));
    this.renderQuests(untracked(() => this.questService.quests()));
  }

  protected goToQuestFromList(item: NearbyQuestItem): void {
    this.nearbySheetOpen.set(false);
    if (!this.map) return;
    this.haptics.medium();
    this.map.flyTo({
      center: [item.lng, item.lat],
      zoom: Math.max(this.map.getZoom(), this.USER_FOCUS_ZOOM),
      pitch: this.INITIAL_PITCH,
      duration: 800,
    });
    const quest = untracked(() => this.questService.quests()).find((q) => q.id === item.id);
    if (quest) {
      setTimeout(() => {
        void this.openQuestDetailSheet(quest, this.questService.playerStatusOf(quest.id));
      }, 850);
    }
  }

  protected formatDistance(meters: number | null): string {
    if (meters === null) return 'esplora la mappa';
    if (meters < 1000) return `a ${meters} m`;
    return `a ${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  }

  protected async openObjectiveAction(): Promise<void> {
    const obj = this.objective();
    if (!obj) return;
    if (obj.inRange) {
      void this.haptics.tapHeavy();
      if (obj.type === QuestType.PRIMARY) {
        const modal = await this.modalCtrl.create({
          component: ScanModalComponent,
          cssClass: 'tq-scan-modal',
          backdropDismiss: false,
          componentProps: { questId: obj.quest.id },
        });
        await modal.present();
      } else {
        void this.openQuestDetailSheet(obj.quest, this.questService.playerStatusOf(obj.quest.id));
      }
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

  private async openQuestDetailSheet(quest: AnyQuest, status: PlayerStatus): Promise<void> {
    if (this.activeSheet) {
      await this.activeSheet.dismiss();
      this.activeSheet = null;
    }

    const modal = await this.modalCtrl.create({
      component: QuestDetailSheetComponent,
      cssClass: 'tq-quest-sheet',
      breakpoints: [0, 0.38, 0.65],
      initialBreakpoint: 0.38,
      backdropBreakpoint: 0.38,
      handle: true,
      componentProps: { quest, status },
    });

    this.activeSheet = modal;
    await modal.present();
    await modal.onDidDismiss();
    if (this.activeSheet === modal) this.activeSheet = null;
  }

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
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    });

    this.map.on('style.load', () => this.onStyleLoad());
    this.map.on('rotate', () => {
      if (!this.map) return;
      this.compassAngle.set(-this.map.getBearing());
      this.updateUserHeadingVisual();
    });
    setTimeout(() => this.map?.resize(), 0);
  }

  private onStyleLoad(): void {
    this.addTrentinoOverlay();
    this.addGeoJsonSourcesAndLayers();
    const pos = untracked(() => this.geolocationService.position());
    if (pos) this.syncUserGpsLayers(pos.lat, pos.lng, pos.accuracy);
    void this.addQuestLayers().then(() => {
      const quests = untracked(() => this.questService.quests());
      if (quests.length > 0) this.renderQuests(quests);
    });
    setTimeout(() => this.map?.resize(), 0);
  }

  private addGeoJsonSourcesAndLayers(): void {
    if (!this.map) return;

    this.map.addSource(this.SOURCE_PRIMARY, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    this.map.addLayer({
      id: this.LAYER_PRIMARY_FILL,
      type: 'fill',
      source: this.SOURCE_PRIMARY,
      paint: { 'fill-color': ['get', 'fillColor'], 'fill-opacity': ['get', 'fillOpacity'] },
    });
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

    this.map.on('click', this.LAYER_PRIMARY_FILL, (e) => {
      if (Date.now() - this.lastQuestClickMs < 100) return;
      if (!e.features?.length) return;
      const questId = e.features[0].properties?.['questId'] as string;
      const quest = untracked(() => this.questService.quests()).find((q) => q.id === questId);
      if (!quest) return;
      this.lastQuestClickMs = Date.now();
      void this.openQuestDetailSheet(quest, this.questService.playerStatusOf(quest.id));
    });

    this.map.on('mouseenter', this.LAYER_PRIMARY_FILL, () => {
      if (this.map) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', this.LAYER_PRIMARY_FILL, () => {
      if (this.map) this.map.getCanvas().style.cursor = '';
    });

    this.map.addSource(this.SOURCE_UNCERTAINTY, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    this.map.addLayer({
      id: this.LAYER_UNCERTAINTY_FILL,
      type: 'fill',
      source: this.SOURCE_UNCERTAINTY,
      paint: { 'fill-color': 'rgba(64, 145, 108, 1)', 'fill-opacity': 0.14 },
    });
    this.map.addLayer({
      id: this.LAYER_UNCERTAINTY_LINE,
      type: 'line',
      source: this.SOURCE_UNCERTAINTY,
      paint: { 'line-color': 'rgba(64, 145, 108, 0.55)', 'line-width': 1 },
    });
  }

  private addTrentinoOverlay(): void {
    if (!this.map) return;

    const mode = this.themeService.effectiveTheme();
    const maskBg = mode === 'dark' ? '#0d1117' : '#f0ede6';
    const lineColor =
      getComputedStyle(document.body).getPropertyValue('--color-primary').trim() || '#2d6a4f';

    this.map.addSource(this.SOURCE_TRENTINO_MASK, { type: 'geojson', data: TRENTINO_MASK });
    this.map.addSource(this.SOURCE_TRENTINO_VALLEYS, {
      type: 'geojson',
      data: TRENTINO_VALLEY_LINES,
    });

    this.map.addLayer({
      id: this.LAYER_TRENTINO_MASK_FILL,
      type: 'fill',
      source: this.SOURCE_TRENTINO_MASK,
      paint: { 'fill-color': maskBg, 'fill-opacity': 1 },
    });

    this.map.addLayer({
      id: this.LAYER_TRENTINO_VALLEY_LINES,
      type: 'line',
      source: this.SOURCE_TRENTINO_VALLEYS,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': lineColor,
        'line-width': 1.5,
        'line-opacity': 0.75,
      },
    });
  }

  private renderQuests(quests: AnyQuest[]): void {
    if (!this.map || !this.map.getSource(this.SOURCE_PRIMARY)) return;
    const filtered = this.applyFilter(quests);
    this.updatePrimaryCirclesSource(filtered);
    (this.map.getSource(this.SOURCE_QUESTS) as maplibregl.GeoJSONSource | undefined)?.setData(
      this.buildQuestsGeoJSON(filtered),
    );
    (
      this.map.getSource(this.SOURCE_VALLEY_CLUSTERS) as maplibregl.GeoJSONSource | undefined
    )?.setData(buildValleyClusters(filtered, (id) => this.questService.playerStatusOf(id)));
  }

  private buildQuestsGeoJSON(quests: AnyQuest[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
    return {
      type: 'FeatureCollection',
      features: quests.map((q) => {
        const isPrimary = q.type === QuestType.PRIMARY;
        const lat = isPrimary
          ? (q as PrimaryQuest).searchArea.lat
          : (q as SecondaryQuest).position.lat;
        const lng = isPrimary
          ? (q as PrimaryQuest).searchArea.lng
          : (q as SecondaryQuest).position.lng;
        const playerStatus = this.questService.playerStatusOf(q.id);
        const questType = isPrimary ? 'primary' : 'secondary';
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            questId: q.id,
            iconImage: `quest-${playerStatus}-${questType}`,
          },
        };
      }),
    };
  }

  private async addQuestLayers(): Promise<void> {
    if (!this.map) return;

    const primaryColor =
      getComputedStyle(document.body).getPropertyValue('--color-primary').trim() || '#2d6a4f';

    await registerQuestIcons(this.map, primaryColor);

    // Source singola senza clustering nativo — gestiamo noi per valle
    this.map.addSource(this.SOURCE_QUESTS, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    this.map.addLayer({
      id: this.LAYER_QUEST_POINTS,
      type: 'symbol',
      source: this.SOURCE_QUESTS,
      layout: {
        'icon-image': ['get', 'iconImage'],
        'icon-size': 1,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        visibility: 'none',
      },
    });

    // Source cluster per valle
    this.map.addSource(this.SOURCE_VALLEY_CLUSTERS, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    this.map.addLayer({
      id: this.LAYER_VALLEY_CIRCLES,
      type: 'circle',
      source: this.SOURCE_VALLEY_CLUSTERS,
      paint: {
        'circle-color': primaryColor,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 9, 8, 14, 10, 20],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-translate': [0, -3],
      },
    });

    this.map.addLayer({
      id: this.LAYER_VALLEY_COUNT,
      type: 'symbol',
      source: this.SOURCE_VALLEY_CLUSTERS,
      layout: {
        'text-field': ['to-string', ['get', 'questCount']],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 8, 11, 10, 13],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-offset': [0, -0.25],
      },
      paint: { 'text-color': '#ffffff' },
    });

    this.syncQuestLayerVisibility();

    // Zoom → alterna visibilità
    this.map.on('zoomend', () => this.syncQuestLayerVisibility());

    // Click su quest individuale
    this.map.on('click', this.LAYER_QUEST_POINTS, (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      this.lastQuestClickMs = Date.now();
      const questId = feature.properties?.['questId'] as string;
      const quest = untracked(() => this.questService.quests()).find((q) => q.id === questId);
      if (!quest) return;
      this.haptics.light();
      void this.openQuestDetailSheet(quest, this.questService.playerStatusOf(quest.id));
    });

    // Click su cluster di valle → zoom in
    this.map.on('click', this.LAYER_VALLEY_CIRCLES, (e) => {
      if (!this.map) return;
      this.map.easeTo({ center: e.lngLat, zoom: this.VALLEY_ZOOM_THRESHOLD + 1, duration: 600 });
    });
    this.map.on('click', this.LAYER_VALLEY_COUNT, (e) => {
      if (!this.map) return;
      this.map.easeTo({ center: e.lngLat, zoom: this.VALLEY_ZOOM_THRESHOLD + 1, duration: 600 });
    });

    for (const layer of [
      this.LAYER_QUEST_POINTS,
      this.LAYER_VALLEY_CIRCLES,
      this.LAYER_VALLEY_COUNT,
    ]) {
      this.map.on('mouseenter', layer, () => {
        if (this.map) this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', layer, () => {
        if (this.map) this.map.getCanvas().style.cursor = '';
      });
    }
  }

  private syncQuestLayerVisibility(): void {
    if (!this.map) return;
    const zoom = this.map.getZoom();
    const showValley = zoom < this.VALLEY_ZOOM_THRESHOLD;
    const vis = (v: boolean) => (v ? 'visible' : 'none') as 'visible' | 'none';
    this.map.setLayoutProperty(this.LAYER_QUEST_POINTS, 'visibility', vis(!showValley));
    this.map.setLayoutProperty(this.LAYER_PRIMARY_FILL, 'visibility', vis(!showValley));
    this.map.setLayoutProperty(this.LAYER_PRIMARY_LINE_SOLID, 'visibility', vis(!showValley));
    this.map.setLayoutProperty(this.LAYER_PRIMARY_LINE_DASHED, 'visibility', vis(!showValley));
    this.map.setLayoutProperty(this.LAYER_VALLEY_CIRCLES, 'visibility', vis(showValley));
    this.map.setLayoutProperty(this.LAYER_VALLEY_COUNT, 'visibility', vis(showValley));
  }

  private applyFilter(quests: AnyQuest[]): AnyQuest[] {
    const f = this.mapFilter();
    return quests.filter((q) => {
      const status = this.questService.playerStatusOf(q.id);
      if (status === 'discovered' && !f.showCompleted) return false;
      if (q.type === QuestType.PRIMARY && !f.showPrimary) return false;
      if (q.type === QuestType.SECONDARY && !f.showSecondary) return false;
      return true;
    });
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
      playerStatus === 'discovered' ? '#2d6a4f' : playerStatus === 'locked' ? '#888888' : '#40916c';
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

  private syncUserGpsLayers(lat: number, lng: number, accuracy: number): void {
    if (!this.map) return;

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
      this.updateUserHeadingVisual();
    } else {
      this.userMarker.setLngLat([lng, lat]);
    }

    if (accuracy > this.ACCURACY_THRESHOLD_METERS) {
      this.uncertaintyCircleData = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [buildCirclePolygon(lat, lng, accuracy)] },
          },
        ],
      };
    } else {
      this.uncertaintyCircleData = { type: 'FeatureCollection', features: [] };
    }
    (this.map.getSource(this.SOURCE_UNCERTAINTY) as maplibregl.GeoJSONSource | undefined)?.setData(
      this.uncertaintyCircleData,
    );

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

  private updateUserHeadingVisual(): void {
    if (!this.userMarker || this.userHeading == null || !this.map) return;
    const cone = this.userMarker.getElement().querySelector<HTMLElement>('.user-marker__cone');
    if (!cone) return;
    const screenAngle = this.userHeading - this.map.getBearing();
    cone.style.transform = `rotate(${screenAngle}deg)`;
    cone.style.opacity = '1';
  }

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
