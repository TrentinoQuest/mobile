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
} from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import * as L from 'leaflet';
import { QuestService } from '../../../core/services/quest/quest.service';
import { getQuestIcon } from '../../../core/services/quest/quest-icons';
import {
  AnyQuest,
  PrimaryQuest,
  QuestType,
  SecondaryQuest,
} from '../../../core/services/quest/quest.types';
import { QuestPopupComponent } from '../components/quest-popup/quest-popup.component';

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
 * Migrazione al backend: zero modifiche a questo file.
 * Basta cambiare il provider in main.ts da MockQuestRepository a
 * HttpQuestRepository.
 *
 * Popup: componente Angular standalone QuestPopupComponent istanziato
 * dinamicamente al click. Distrutto al close per evitare memory leak.
 *
 * TODO 2B-bis: integrare Capacitor Geolocation per GPS reale.
 * TODO 2D: header overlay con collection chip.
 * TODO 2F: gestire click su quest -> navigate(Quest Detail).
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class HomePage implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  // ----------------------------------------------------------------
  // Dependency injection
  // ----------------------------------------------------------------

  private readonly questService = inject(QuestService);
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);

  // ----------------------------------------------------------------
  // Stato interno Leaflet
  // ----------------------------------------------------------------

  private map: L.Map | null = null;
  private userMarker: L.Marker | null = null;

  // Layer separati per primary (cerchi) e secondary (marker).
  // Permettono filtri futuri "solo primary" / "solo secondary".
  private primaryLayer: L.LayerGroup | null = null;
  private secondaryLayer: L.LayerGroup | null = null;

  /**
   * Mappa popupKey -> ComponentRef.
   * Traccia quale popup ha quale componente Angular dietro, e permette
   * di distruggere il componente al close per evitare memory leak.
   */
  private readonly activePopupComponents = new Map<
    string,
    ComponentRef<QuestPopupComponent>
  >();

  // ----------------------------------------------------------------
  // Costanti di configurazione mappa
  // ----------------------------------------------------------------

  private readonly INITIAL_CENTER: L.LatLngTuple = [46.0667, 11.1167];
  private readonly MOCK_USER_POSITION: L.LatLngTuple = [46.0681, 11.1211];
  private readonly INITIAL_ZOOM = 14;
  private readonly MIN_ZOOM = 9;
  private readonly MAX_ZOOM = 18;
  private readonly TRENTINO_BOUNDS: L.LatLngBoundsLiteral = [
    [45.6, 10.4],
    [46.6, 12.0],
  ];
  private readonly TILE_URL =
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  private readonly TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>';

  // ----------------------------------------------------------------
  // Effects reattivi sui dati
  // ----------------------------------------------------------------

  constructor() {
    // Effect: re-render dei marker quando quests() o completions() cambiano.
    // Combinato in un solo effect perche' lo stato giocatore (discovered/
    // available) dipende da entrambi.
    effect(() => {
      // Tracciati: signal "quests" e "completions" via playerStatusOf
      // letto dentro renderQuests().
      const quests = this.questService.quests();
      this.questService.completions(); // forza dipendenza
      this.renderQuests(quests);
    });

    // TODO 2D: aggiungere effect per loading() ed error() quando ci
    //   sara' UI per stati di caricamento e di errore.
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  ngAfterViewInit(): void {
    this.initMap();
    this.addUserMarker();

    // Se il servizio ha già dati cachati (navigazione back), l'effect può
    // essere già stato eseguito prima che la mappa fosse pronta e aver
    // restituito early. Ridisegniamo esplicitamente dopo l'init.
    this.renderQuests(this.questService.quests());

    // Carica dati dal repository. Gli effect ridisegneranno i marker.
    this.questService.loadQuests();
    this.questService.loadCompletions();
  }

  ngOnDestroy(): void {
    this.activePopupComponents.forEach((ref) => ref.destroy());
    this.activePopupComponents.clear();

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.userMarker = null;
    this.primaryLayer = null;
    this.secondaryLayer = null;
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
      subdomains: 'abcd',
    }).addTo(this.map);

    // Layer group vuoti, popolati dagli effect.
    this.primaryLayer = L.layerGroup().addTo(this.map);
    this.secondaryLayer = L.layerGroup().addTo(this.map);
  }

  // ----------------------------------------------------------------
  // Rendering quest (reattivo)
  // ----------------------------------------------------------------

  /**
   * Ridisegna primary e secondary quest dai signal.
   * Chiamato dall'effect quando quests() o completions() cambiano.
   */
  private renderQuests(quests: AnyQuest[]): void {
    if (!this.map || !this.primaryLayer || !this.secondaryLayer) return;

    // Pulisci entrambi i layer.
    this.primaryLayer.clearLayers();
    this.secondaryLayer.clearLayers();

    // Distribuisci le quest nei layer per tipo.
    quests.forEach((quest) => {
      if (quest.type === QuestType.PRIMARY) {
        this.renderPrimaryQuest(quest);
      } else {
        this.renderSecondaryQuest(quest);
      }
    });
  }

  /**
   * Renderizza una primary quest come cerchio (area di ricerca del QR).
   * Il cerchio NON e' il marker della quest: e' la zona entro cui il QR
   * e' nascosto.
   */
  private renderPrimaryQuest(quest: PrimaryQuest): void {
    if (!this.primaryLayer) return;

    const playerStatus = this.questService.playerStatusOf(quest.id);

    // Colore del cerchio in base allo stato giocatore.
    // discovered -> forest, locked -> muted, available -> ocra
    const fillColor =
      playerStatus === 'discovered'
        ? '#6BA046'
        : playerStatus === 'locked'
          ? '#666'
          : '#C8930F';

    const circle = L.circle([quest.searchArea.lat, quest.searchArea.lng], {
      radius: quest.searchRadiusMeters,
      color: fillColor,
      fillColor: fillColor,
      fillOpacity: playerStatus === 'discovered' ? 0.05 : 0.08,
      opacity: playerStatus === 'discovered' ? 0.3 : 0.45,
      weight: 1.5,
      dashArray: '4 6',
    });

    this.bindDynamicPopup(circle, 'primary-' + quest.id, () =>
      this.createPopupForQuest(quest, playerStatus),
    );

    circle.addTo(this.primaryLayer);
  }

  /**
   * Renderizza una secondary quest come marker puntuale.
   */
  private renderSecondaryQuest(quest: SecondaryQuest): void {
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
  // User marker
  // ----------------------------------------------------------------

  private addUserMarker(): void {
    if (!this.map) return;

    const userIcon = L.divIcon({
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

    this.userMarker = L.marker(this.MOCK_USER_POSITION, {
      icon: userIcon,
      interactive: false,
      keyboard: false,
    }).addTo(this.map);

    // TODO 2B-bis: integrare Capacitor Geolocation per GPS reale.
  }
}