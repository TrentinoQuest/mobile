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
import * as L from 'leaflet';
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

/**
 * Home Giocatore — vista principale mappa-centrica.
 *
 * Architettura dati (allineata a OpenAPI v0.2.0):
 * Il componente consuma QuestService che espone signal reattivi
 * (quests, completions, loading, error). Gli effect ridisegnano i
 * marker quando i signal cambiano.
 *
 * Rendering quest:
 * - PrimaryQuest -> L.circle attorno a searchArea (raggio = searchRadiusMeters),
 *   visualizzata come zona soffusa di ricerca per il QR nascosto
 * - SecondaryQuest -> L.marker puntuale sulla position (check-in entro
 *   checkInRadiusMeters)
 *
 * Posizione utente (Step 2B-bis):
 * Il marker utente e' reattivo al signal GeolocationService.position().
 * Quando arriva il primo fix valido, la mappa fa flyTo sulla posizione
 * (one-shot per sessione). Se accuracy > 50m, viene disegnato un cerchio
 * di incertezza intorno al marker (raggio = accuracy in metri).
 *
 * Migrazione al backend: zero modifiche a questo file.
 * Basta cambiare il provider in main.ts da MockQuestRepository a
 * HttpQuestRepository.
 *
 * Popup: componente Angular standalone QuestPopupComponent istanziato
 * dinamicamente al click. Distrutto al close per evitare memory leak.
 *
 * TODO 2D: header overlay con collection chip.
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
  private mapContainer!: ElementRef<HTMLDivElement>;

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
  // Stato interno Leaflet
  // ----------------------------------------------------------------

  private map: L.Map | null = null;
  private userMarker: L.Marker | null = null;
  private uncertaintyCircle: L.Circle | null = null;

  private primaryLayer: L.LayerGroup | null = null;
  private secondaryLayer: L.LayerGroup | null = null;


  /** Mappa questId → marker Leaflet per aprire popup da toast o da codice. */
  private readonly questMarkers = new Map<string, L.Marker>();

  /**
   * Flag one-shot per l'auto-center al primo fix valido di sessione.
   * Resettato a false in ngAfterViewInit (back nav → nuovo auto-center).
   */
  private hasAutoCentered = false;

  /**
   * Mappa popupKey -> ComponentRef.
   * Traccia quale popup ha quale componente Angular dietro, e permette
   * di distruggere il componente al close per evitare memory leak.
   */
  private readonly activePopupComponents = new Map<string, ComponentRef<QuestPopupComponent>>();

  /** Intervallo per il refresh periodico della mappa. */
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  /** Ogni 30s forza reload quests+completions per vedere nuove quest o completamenti. */
  private readonly REFRESH_INTERVAL_MS = 30_000;

  // ----------------------------------------------------------------
  // Proximity toast
  // ----------------------------------------------------------------

  /** Toast che appare quando il giocatore si avvicina a una quest disponibile. */
  protected readonly proximityToast = signal<{
    questId: string;
    questName: string;
    inRange: boolean;
    type: QuestType;
  } | null>(null);

  /** Timer per l'auto-dismiss del toast (5s). */
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  /** ID dell'ultima quest per cui abbiamo mostrato il toast, evita spam. */
  private lastToastQuestId: string | null = null;

  // ----------------------------------------------------------------
  // Costanti di configurazione mappa
  // ----------------------------------------------------------------

  private readonly INITIAL_CENTER: L.LatLngTuple = [46.0667, 11.1167];
  private readonly INITIAL_ZOOM = 14;
  private readonly USER_FOCUS_ZOOM = 16;
  private readonly MIN_ZOOM = 9;
  private readonly MAX_ZOOM = 18;
  private readonly TRENTINO_BOUNDS: L.LatLngBoundsLiteral = [
    [45.6, 10.4],
    [46.6, 12.0],
  ];
  /** OpenStreetMap standard — tile con colori naturali (laghi, montagne, terreno).
   *  Il tema dark/light è gestito via CSS filter in global.scss, non cambiando URL. */
  private readonly TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  private readonly TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  /** Zoom sotto il quale i marker vengono aggregati in cluster bubble. */
  private readonly CLUSTER_ZOOM_THRESHOLD = 13;
  /** Dimensione cella griglia (pixel) per il calcolo del clustering. */
  private readonly CLUSTER_GRID_PX = 70;

  /**
   * Soglia accuracy oltre la quale disegniamo l'alone di incertezza
   * attorno al marker user. Sotto questa soglia il fix e' considerato
   * "abbastanza preciso" per essere mostrato senza qualificazione.
   * Decisione di progetto sulla UX (vedi piano Fase 3).
   */
  private readonly ACCURACY_THRESHOLD_METERS = 50;

  // ----------------------------------------------------------------
  // Effects reattivi sui dati
  // ----------------------------------------------------------------

  constructor() {
    // Effect: re-render dei marker quando quests() o completions() cambiano.
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

  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  ngAfterViewInit(): void {
    this.initMap();

    // Reset del flag auto-center: ogni volta che il componente viene
    // ricostruito (es. dopo back navigation), permettiamo un nuovo
    // flyTo al primo fix successivo.
    this.hasAutoCentered = false;

    // Se il servizio ha già dati cachati (navigazione back), l'effect può
    // essere già stato eseguito prima che la mappa fosse pronta e aver
    // restituito early. Ridisegniamo esplicitamente dopo l'init.
    this.renderQuests(this.questService.quests());

    // Stessa cosa per il GPS: se il GeolocationService ha gia' una
    // posizione (probabile: il watch parte al login), sincronizziamo
    // subito i layer utente. Senza questo, dovremmo aspettare il
    // prossimo fix del watch (fino a 5s).
    const currentPosition = this.geolocationService.position();
    if (currentPosition) {
      this.syncUserGpsLayers(currentPosition.lat, currentPosition.lng, currentPosition.accuracy);
    }

    // Carica dati dal repository. Gli effect ridisegneranno i marker.
    // Fatto qui e non in ionViewWillEnter perché ionViewWillEnter non scatta
    // per il tab di default all'apertura iniziale dell'app.
    this.questService.loadQuests();
    this.questService.loadCompletions();

    // Leaflet misura il container durante initMap(). Se il layout Ionic
    // non ha ancora calcolato le dimensioni (primo render dopo login),
    // il container risulta 0×0 e i tile non vengono caricati.
    // invalidateSize() sul microtask successivo forza il recalcolo.
    setTimeout(() => this.map?.invalidateSize(), 0);

    // Refresh periodico: ionViewWillEnter non scatta con <router-outlet> standard,
    // quindi aggiorniamo quests e completions ogni 30s per vedere nuovi dati
    // senza chiedere all'utente di uscire e rientrare dall'app.
    this.refreshInterval = setInterval(() => {
      this.questService.loadQuests(undefined, true);
      this.questService.loadCompletions(undefined, undefined, true);
    }, this.REFRESH_INTERVAL_MS);
  }

  protected centerOnUser(): void {
    const pos = this.geolocationService.position();
    if (!pos || !this.map) return;
    this.map.flyTo([pos.lat, pos.lng], this.USER_FOCUS_ZOOM, { duration: 0.8 });
  }

  ionViewWillEnter(): void {
    // Leaflet non ridisegna quando il tab torna in primo piano dopo essere
    // stato nascosto: invalidateSize() ricalcola container e ricarica i tile.
    setTimeout(() => this.map?.invalidateSize(), 100);

    // Forza refresh dei dati: quest aggiunte dal backoffice o completamenti
    // da altre sessioni diventano visibili senza riavviare l'app.
    // (ionViewWillEnter non scatta al caricamento iniziale del tab di default,
    // quindi il primo fetch resta in ngAfterViewInit — questo copre i ritorni.)
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

    this.activePopupComponents.forEach((ref) => ref.destroy());
    this.activePopupComponents.clear();

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.userMarker = null;
    this.uncertaintyCircle = null;
    this.primaryLayer = null;
    this.secondaryLayer = null;
  }

  protected dismissToast(): void {
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.proximityToast.set(null);
  }

  /**
   * Controlla se il giocatore si è avvicinato a una quest disponibile.
   * Mostra un toast one-shot per quest (non ripete finché non cambia quest).
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

  /**
   * Azione del toast: apre la scan modal per quest primarie, o il popup
   * sulla mappa per quest secondarie.
   */
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
        this.map.flyTo(marker.getLatLng(), Math.max(this.map.getZoom(), 16), { duration: 0.6 });
        setTimeout(() => marker.openPopup(), 650);
      }
    }
  }

  // ----------------------------------------------------------------
  // Inizializzazione mappa
  // ----------------------------------------------------------------

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.INITIAL_CENTER,
      zoom: this.INITIAL_ZOOM,
      minZoom: this.MIN_ZOOM,
      maxZoom: this.MAX_ZOOM,
      maxBounds: this.TRENTINO_BOUNDS,
      maxBoundsViscosity: 0.8,
      zoomControl: false,
      zoomAnimation: true,
      attributionControl: true,
    });

    L.tileLayer(this.TILE_URL, {
      attribution: this.TILE_ATTRIBUTION,
      maxZoom: this.MAX_ZOOM,
      subdomains: 'abc',
    }).addTo(this.map);

    // Layer group vuoti, popolati dagli effect.
    this.primaryLayer = L.layerGroup().addTo(this.map);
    this.secondaryLayer = L.layerGroup().addTo(this.map);

    // Re-render dei marker al cambio di zoom per aggiornare il clustering.
    this.map.on('zoomend', () => {
      this.renderQuests(untracked(() => this.questService.quests()));
    });
  }

  // ----------------------------------------------------------------
  // Rendering quest (reattivo)
  // ----------------------------------------------------------------

  /**
   * Ridisegna primary e secondary quest dai signal.
   * Chiamato dall'effect quando quests() o completions() cambiano,
   * o dal listener zoomend per aggiornare il clustering.
   *
   * Architettura rendering:
   * - Cerchi area (primary): sempre nel primaryLayer, indipendenti dallo zoom.
   * - Pin marker (primary + secondary + cluster): nel secondaryLayer.
   *   Se zoom < CLUSTER_ZOOM_THRESHOLD → clustering grid-based.
   *   Se zoom ≥ CLUSTER_ZOOM_THRESHOLD → marker individuali.
   */
  private renderQuests(quests: AnyQuest[]): void {
    if (!this.map || !this.primaryLayer || !this.secondaryLayer) return;

    this.primaryLayer.clearLayers();
    this.secondaryLayer.clearLayers();
    this.questMarkers.clear();

    // I cerchi area sono sempre visibili (comunicano il raggio di ricerca QR).
    quests
      .filter((q) => q.type === QuestType.PRIMARY)
      .forEach((q) => this.renderPrimaryCircle(q as PrimaryQuest));

    // Pin marker: individuali o raggruppati in base allo zoom corrente.
    if (this.map.getZoom() < this.CLUSTER_ZOOM_THRESHOLD) {
      this.renderWithClustering(quests);
    } else {
      this.renderFlat(quests);
    }
  }

  /** Render non-clustered: un marker per ogni quest. */
  private renderFlat(quests: AnyQuest[]): void {
    let staggerIndex = 0;
    quests.forEach((quest) => {
      if (quest.type === QuestType.PRIMARY) {
        this.renderPrimaryMarker(quest as PrimaryQuest, staggerIndex++);
      } else {
        this.renderSecondaryMarker(quest as SecondaryQuest, staggerIndex++);
      }
    });
  }

  /**
   * Render con clustering grid-based.
   * Raggruppa i marker per cella di una griglia pixel (CLUSTER_GRID_PX):
   * celle con >1 quest → bolla cluster; celle con 1 quest → marker individuale.
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
      const pixel = this.map!.latLngToContainerPoint([item.lat, item.lng]);
      const key = `${Math.floor(pixel.x / gridSize)},${Math.floor(pixel.y / gridSize)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(item);
    }

    let staggerIndex = 0;
    for (const [, group] of cells) {
      if (group.length === 1) {
        const { quest } = group[0];
        if (quest.type === QuestType.PRIMARY) {
          this.renderPrimaryMarker(quest as PrimaryQuest, staggerIndex++);
        } else {
          this.renderSecondaryMarker(quest as SecondaryQuest, staggerIndex++);
        }
      } else {
        const avgLat = group.reduce((s, i) => s + i.lat, 0) / group.length;
        const avgLng = group.reduce((s, i) => s + i.lng, 0) / group.length;
        this.renderClusterMarker(avgLat, avgLng, group.length, staggerIndex++);
      }
    }
  }

  /**
   * Renderizza il cerchio di area di una primary quest.
   * Il cerchio indica la zona entro cui è nascosto il QR da scansionare.
   * Separato dal pin marker per permettere rendering indipendente dallo zoom.
   */
  private renderPrimaryCircle(quest: PrimaryQuest): void {
    if (!this.primaryLayer) return;

    const playerStatus = this.questService.playerStatusOf(quest.id);
    const fillColor =
      playerStatus === 'discovered' ? '#6BA046' : playerStatus === 'locked' ? '#666' : '#C8930F';

    const isAvailable = playerStatus === 'available';
    const isDiscovered = playerStatus === 'discovered';

    const circle = L.circle([quest.searchArea.lat, quest.searchArea.lng], {
      radius: quest.searchRadiusMeters,
      color: fillColor,
      fillColor: fillColor,
      fillOpacity: isAvailable ? 0.20 : isDiscovered ? 0.06 : 0.05,
      opacity: isAvailable ? 1.0 : isDiscovered ? 0.35 : 0.25,
      weight: isAvailable ? 3 : 1.5,
      dashArray: isAvailable ? undefined : '6 8',
      className: `quest-primary-circle quest-primary-circle--${playerStatus}`,
    });

    this.bindDynamicPopup(circle, 'primary-' + quest.id, () =>
      this.createPopupForQuest(quest, playerStatus),
    );

    circle.addTo(this.primaryLayer);
  }

  /**
   * Renderizza il pin centrale di una primary quest.
   * Più grande e prominente dei secondari (44×44 vs 36×36),
   * con zIndexOffset alto per stare sempre sopra i marker secondari.
   */
  private renderPrimaryMarker(quest: PrimaryQuest, staggerIndex = 0): void {
    if (!this.secondaryLayer) return;

    const playerStatus = this.questService.playerStatusOf(quest.id);
    const iconSvg = getQuestIcon(quest, playerStatus);

    const icon = L.divIcon({
      className: 'quest-marker-wrapper',
      html: `
        <div class="quest-marker quest-marker--primary quest-marker--${playerStatus}">
          <div class="quest-marker__pin">${iconSvg}</div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    });

    const marker = L.marker([quest.searchArea.lat, quest.searchArea.lng], {
      icon,
      interactive: true,
      riseOnHover: true,
      zIndexOffset: 1000,
    });

    this.bindDynamicPopup(marker, 'primary-pin-' + quest.id, () =>
      this.createPopupForQuest(quest, playerStatus),
    );

    marker.addTo(this.secondaryLayer);

    marker.once('add', () => {
      const el = marker.getElement();
      if (!el) return;
      el.style.setProperty('--stagger-delay', `${staggerIndex * 65}ms`);
      el.classList.add('quest-marker-wrapper--enter');
    });
  }

  /**
   * Renderizza una secondary quest come marker puntuale.
   */
  private renderSecondaryMarker(quest: SecondaryQuest, staggerIndex = 0): void {
    if (!this.secondaryLayer) return;

    const playerStatus = this.questService.playerStatusOf(quest.id);
    const icon = this.createQuestIcon(quest, playerStatus);

    const marker = L.marker([quest.position.lat, quest.position.lng], {
      icon,
      interactive: true,
      riseOnHover: true,
    });

    this.bindDynamicPopup(marker, 'secondary-' + quest.id, () =>
      this.createPopupForQuest(quest, playerStatus),
    );

    marker.addTo(this.secondaryLayer);
    this.questMarkers.set(quest.id, marker);

    marker.once('add', () => {
      const el = marker.getElement();
      if (!el) return;
      el.style.setProperty('--stagger-delay', `${staggerIndex * 65}ms`);
      el.classList.add('quest-marker-wrapper--enter');
    });
  }

  /**
   * Renderizza una bolla cluster che aggrega più quest nello stesso punto
   * della griglia pixel. Non interattiva: l'utente zooma per vedere i singoli.
   */
  private renderClusterMarker(lat: number, lng: number, count: number, staggerIndex = 0): void {
    if (!this.secondaryLayer) return;

    const icon = L.divIcon({
      className: 'quest-cluster-wrapper',
      html: `
        <div class="quest-cluster">
          <span class="quest-cluster__count">${count}</span>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const marker = L.marker([lat, lng], { icon, interactive: false });
    marker.addTo(this.secondaryLayer);

    marker.once('add', () => {
      const el = marker.getElement();
      if (!el) return;
      el.style.setProperty('--stagger-delay', `${staggerIndex * 65}ms`);
      el.classList.add('quest-marker-wrapper--enter');
    });
  }

  /**
   * Crea un L.DivIcon per una quest in base a tipo e stato giocatore.
   */
  private createQuestIcon(
    quest: AnyQuest,
    playerStatus: ReturnType<QuestService['playerStatusOf']>,
  ): L.DivIcon {
    const iconSvg = getQuestIcon(quest, playerStatus);

    return L.divIcon({
      className: 'quest-marker-wrapper',
      html: `
        <div class="quest-marker quest-marker--${playerStatus}">
          <div class="quest-marker__pin">${iconSvg}</div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  }

  // ----------------------------------------------------------------
  // Popup dinamici (componenti Angular dentro Leaflet)
  // ----------------------------------------------------------------

  /**
   * Aggancia un popup Leaflet a un layer (marker o cerchio) montando
   * dinamicamente un componente Angular al click.
   */
  private bindDynamicPopup(
    layer: L.Layer,
    key: string,
    createRef: () => ComponentRef<QuestPopupComponent>,
  ): void {
    const popup = L.popup({
      closeButton: true,
      autoClose: true,
      closeOnClick: true,
      className: 'tq-quest-popup',
    }).setContent('');

    layer.bindPopup(popup);

    layer.on('popupopen', () => {
      const ref = createRef();
      this.activePopupComponents.set(key, ref);
      popup.setContent(ref.location.nativeElement);
      ref.changeDetectorRef.detectChanges();
      popup.update();
    });

    layer.on('popupclose', () => {
      const ref = this.activePopupComponents.get(key);
      if (ref) {
        ref.destroy();
        this.activePopupComponents.delete(key);
      }
    });
  }

  /**
   * Crea un QuestPopupComponent popolato con i dati di una quest specifica.
   */
  private createPopupForQuest(
    quest: AnyQuest,
    playerStatus: ReturnType<QuestService['playerStatusOf']>,
  ): ComponentRef<QuestPopupComponent> {
    const componentRef = createComponent(QuestPopupComponent, {
      environmentInjector: this.envInjector,
    });

    componentRef.setInput('questData', quest);
    componentRef.setInput('status', playerStatus);

    this.appRef.attachView(componentRef.hostView);

    return componentRef;
  }

  // ----------------------------------------------------------------
  // User GPS layers (marker + alone incertezza)
  // ----------------------------------------------------------------

  /**
   * Sincronizza marker user e cerchio di incertezza con la posizione GPS
   * corrente. Idempotente: crea i layer la prima volta, aggiorna le
   * coordinate alle chiamate successive.
   *
   * Al primo fix di sessione (hasAutoCentered === false) esegue il flyTo
   * one-shot sulla posizione utente. I fix successivi NON ricentrano la
   * mappa: l'utente che esplora la mappa non vuole essere strappato via
   * a ogni aggiornamento GPS.
   */
  private syncUserGpsLayers(lat: number, lng: number, accuracy: number): void {
    if (!this.map) return;

    const latLng: L.LatLngTuple = [lat, lng];

    // 1. Marker user — crea la prima volta, aggiorna le successive.
    if (this.userMarker === null) {
      this.userMarker = L.marker(latLng, {
        icon: this.createUserIcon(),
        interactive: false,
        keyboard: false,
      }).addTo(this.map);
    } else {
      this.userMarker.setLatLng(latLng);
    }

    // 2. Alone di incertezza — visibile solo se accuracy supera la soglia.
    //    Sotto soglia: il fix e' considerato "preciso", niente alone.
    //    Sopra soglia: cerchio con raggio = accuracy (in metri, scala mappa).
    if (accuracy > this.ACCURACY_THRESHOLD_METERS) {
      if (this.uncertaintyCircle === null) {
        this.uncertaintyCircle = L.circle(latLng, {
          radius: accuracy,
          color: 'rgba(184, 134, 11, 0.4)',
          fillColor: 'rgba(184, 134, 11, 1)',
          fillOpacity: 0.12,
          weight: 1,
          interactive: false,
        }).addTo(this.map);
      } else {
        this.uncertaintyCircle.setLatLng(latLng);
        this.uncertaintyCircle.setRadius(accuracy);
      }
    } else if (this.uncertaintyCircle !== null) {
      // Accuracy migliorata sotto soglia: rimuovi il cerchio.
      this.map.removeLayer(this.uncertaintyCircle);
      this.uncertaintyCircle = null;
    }

    // 3. Auto-center one-shot al primo fix valido della sessione.
    if (!this.hasAutoCentered) {
      this.map.flyTo(latLng, this.USER_FOCUS_ZOOM, { duration: 1.5 });
      this.hasAutoCentered = true;
    }
  }

  /**
   * Crea il L.DivIcon del marker user (dot ocra + pulse animato).
   * Stili definiti in home.page.scss (.user-marker__dot, .user-marker__pulse).
   */
  private createUserIcon(): L.DivIcon {
    return L.divIcon({
      className: 'user-marker-wrapper',
      html: `
        <div class="user-marker">
          <div class="user-marker__pulse"></div>
          <div class="user-marker__dot"></div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  }
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
