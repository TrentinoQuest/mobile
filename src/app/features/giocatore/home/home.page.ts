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
import { Quest, Zone } from '../../../core/services/quest/quest.types';
import { QuestPopupComponent } from '../components/quest-popup/quest-popup.component';

/**
 * Home Giocatore — vista principale mappa-centrica.
 *
 * Strategia di costruzione:
 * - 2A: mappa Leaflet full-bleed con tile dark warm.
 * - 2B: marker posizione utente con pulse animato (mock GPS).
 * - 2B-bis: integrazione Capacitor Geolocation per GPS reale (chat dedicata).
 * - 2C (corrente): consumo dati via QuestService (repository pattern),
 *   zone come cerchi, marker quest con popup Angular dinamico.
 * - 2D: header overlay con collection chip + progress bar.
 * - 2E: controlli mappa flottanti (zoom, centra-su-di-me).
 * - 2F: card "Vicino a te" + bottom sheet.
 *
 * Architettura dati:
 * Il componente NON conosce la fonte dei dati. Inietta QuestService che
 * espone signal reattivi (zones, quests, loading, error). L'effect()
 * sotto re-renderizza i marker ogni volta che i signal cambiano.
 *
 * Migrazione al backend: zero modifiche a questo file. Basta cambiare
 * il provider in main.ts da MockQuestRepository a HttpQuestRepository.
 *
 * Popup quest:
 * Sostituito il pattern "template string HTML" con componente Angular
 * standalone QuestPopupComponent. Istanziato dinamicamente via
 * createComponent() al click sul marker. Distrutto al close del popup
 * per evitare memory leak.
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
  // Servizi necessari per createComponent() di componenti standalone:
  // - ApplicationRef per registrare il componente nel change detection
  // - EnvironmentInjector per la DI del componente
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);

  // ----------------------------------------------------------------
  // Stato interno Leaflet
  // ----------------------------------------------------------------

  private map: L.Map | null = null;
  private userMarker: L.Marker | null = null;

  // Layer separati permettono di mostrare/nascondere zone e quest in
  // modo indipendente (es. futuri filtri "solo discovered").
  private zonesLayer: L.LayerGroup | null = null;
  private questsLayer: L.LayerGroup | null = null;

  /**
   * Mappa popupOpen -> ComponentRef.
   * Permette di tracciare quale popup ha quale componente Angular dietro,
   * e di distruggere il componente al close per evitare memory leak.
   * La chiave e' l'id della quest o della zona.
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
    // Effect 1: re-render zone quando il signal zones() cambia.
    // Si attiva al primo loadZones() e a ogni reload futuro.
    effect(() => {
      const zones = this.questService.zones();
      this.renderZones(zones);
    });

    // Effect 2: re-render quest marker quando il signal quests() cambia.
    // Si attiva al primo loadQuests() e dopo ogni markAsDiscovered.
    effect(() => {
      const quests = this.questService.quests();
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

    // Carica i dati dopo che la mappa esiste. Gli effect() ridisegneranno
    // automaticamente i marker quando i signal si popolano.
    this.questService.loadZones();
    this.questService.loadQuests();
  }

  ngOnDestroy(): void {
    // Distruggi tutti i ComponentRef dei popup aperti per evitare memory leak.
    this.activePopupComponents.forEach((ref) => ref.destroy());
    this.activePopupComponents.clear();

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.userMarker = null;
    this.zonesLayer = null;
    this.questsLayer = null;
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

    // Inizializza i layer group vuoti — popolati poi dagli effect.
    this.zonesLayer = L.layerGroup().addTo(this.map);
    this.questsLayer = L.layerGroup().addTo(this.map);
  }

  // ----------------------------------------------------------------
  // Rendering zone (reattivo)
  // ----------------------------------------------------------------

  /**
   * Pulisce e ridisegna le zone dal signal.
   * Chiamato automaticamente dall'effect quando questService.zones() cambia.
   */
  private renderZones(zones: Zone[]): void {
    if (!this.map || !this.zonesLayer) return;

    // Pulizia: rimuovi le zone precedenti.
    this.zonesLayer.clearLayers();

    zones.forEach((zone) => {
      const circle = L.circle([zone.center.lat, zone.center.lng], {
        radius: zone.radiusMeters,
        color: '#C8930F',
        fillColor: '#C8930F',
        fillOpacity: 0.08,
        opacity: 0.45,
        weight: 1.5,
        dashArray: '4 6',
      });

      // Popup montato dinamicamente al click.
      this.bindDynamicPopup(circle, 'zone-' + zone.id, () => {
        const ref = this.createPopupComponent();
        ref.setInput('zoneData', zone);
        return ref;
      });

      circle.addTo(this.zonesLayer!);
    });
  }

  // ----------------------------------------------------------------
  // Rendering quest marker (reattivo)
  // ----------------------------------------------------------------

  /**
   * Pulisce e ridisegna i marker quest dal signal.
   * Chiamato automaticamente dall'effect quando questService.quests() cambia.
   */
  private renderQuests(quests: Quest[]): void {
    if (!this.map || !this.questsLayer) return;

    this.questsLayer.clearLayers();

    quests.forEach((quest) => {
      const icon = this.createQuestIcon(quest);

      const marker = L.marker([quest.position.lat, quest.position.lng], {
        icon,
        interactive: true,
        riseOnHover: true,
      });

      // Popup montato dinamicamente al click.
      this.bindDynamicPopup(marker, 'quest-' + quest.id, () => {
        const ref = this.createPopupComponent();
        ref.setInput('questData', quest);
        return ref;
      });

      marker.addTo(this.questsLayer!);
    });
  }

  /**
   * Crea un L.DivIcon per una quest in base allo stato e categoria.
   * L'SVG dell'icona viene dal registry quest-icons.
   */
  private createQuestIcon(quest: Quest): L.DivIcon {
    const iconSvg = getQuestIcon(quest);

    return L.divIcon({
      className: 'quest-marker-wrapper',
      html: `
        <div class="quest-marker quest-marker--${quest.status}">
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
   * Aggancia un popup Leaflet a un layer (marker o cerchio) in modo che
   * al click sia montato un componente Angular vero (QuestPopupComponent).
   *
   * Il componente viene istanziato lazy (al primo open) e distrutto al close
   * per evitare memory leak. La key serve a tracciare quale componente
   * appartiene a quale layer nella mappa interna.
   *
   * @param layer marker o circle a cui agganciare il popup
   * @param key identificatore univoco per il tracking (es. "quest-q-duomo")
   * @param createRef factory che crea e popola il ComponentRef
   */
  private bindDynamicPopup(
    layer: L.Layer,
    key: string,
    createRef: () => ComponentRef<QuestPopupComponent>,
  ): void {
    // Aggancia un popup vuoto: il contenuto viene generato lazy al click.
    const popup = L.popup({
      closeButton: true,
      autoClose: true,
      closeOnClick: true,
      // className applicata al wrapper esterno del popup, per styling globale.
      className: 'tq-quest-popup',
    });

    layer.bindPopup(popup);

    // Quando il popup si apre, crea il componente e iniettalo nel popup.
    layer.on('popupopen', () => {
      const ref = createRef();
      this.activePopupComponents.set(key, ref);
      // setContent accetta HTMLElement: passiamo il nativeElement del componente.
      popup.setContent(ref.location.nativeElement);
      // Forza una change detection iniziale.
      ref.changeDetectorRef.detectChanges();
    });

    // Quando il popup si chiude, distruggi il componente.
    layer.on('popupclose', () => {
      const ref = this.activePopupComponents.get(key);
      if (ref) {
        ref.destroy();
        this.activePopupComponents.delete(key);
      }
    });
  }

  /**
   * Crea un'istanza di QuestPopupComponent dinamicamente.
   * Va completata con setInput(...) prima di essere mostrata.
   *
   * Pattern: createComponent() di Angular 17+ per componenti standalone.
   * Non serve ViewContainerRef ne ComponentFactoryResolver.
   */
  private createPopupComponent(): ComponentRef<QuestPopupComponent> {
    const componentRef = createComponent(QuestPopupComponent, {
      environmentInjector: this.envInjector,
    });

    // Attacca il componente al ApplicationRef cosi' il change detection
    // di Angular lo include nel ciclo. Senza, il componente esiste in DOM
    // ma i suoi signal non triggerano re-render.
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

    // TODO 2B-bis: in chat dedicata, integrare Capacitor Geolocation:
    //   import { Geolocation } from '@capacitor/geolocation';
    //   const watchId = await Geolocation.watchPosition({}, (pos) => {
    //     if (pos) this.userMarker?.setLatLng([pos.coords.latitude, pos.coords.longitude]);
    //   });
    //   // E in ngOnDestroy: Geolocation.clearWatch({ id: watchId });
  }
}