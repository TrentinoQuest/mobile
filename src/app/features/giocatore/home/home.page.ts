import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import * as L from 'leaflet';

/**
 * Home Giocatore — vista principale mappa-centrica.
 *
 * Strategia di costruzione (per riferimento):
 * - 2A: mappa Leaflet full-bleed con tile dark warm.
 * - 2B (corrente): marker posizione utente con pulse animato (mock GPS).
 * - 2B-bis: integrazione Capacitor Geolocation per GPS reale.
 * - 2C: mock data quest + marker sulla mappa (zone + puntuali).
 * - 2D: header overlay con collection chip + progress bar.
 * - 2E: controlli mappa flottanti (zoom, centra-su-di-me).
 * - 2F: card "Vicino a te" + bottom sheet.
 *
 * Tile provider:
 * CartoDB Dark Matter — gratis, no API key, tema dark blu-grigio che si
 * fonde col nostro background warm-dark. Attribution obbligatoria.
 *
 * Posizione utente (2B — mock):
 * Piazza Duomo Trento, lat 46.0681 / lng 11.1211. Marker custom via
 * L.divIcon con HTML+CSS, animazione pulse via @keyframes.
 *
 * Lifecycle:
 * - ngAfterViewInit: il DOM e' pronto e #mapContainer ha dimensioni
 * - ngOnDestroy: rimuove la mappa per evitare memory leak su navigazione
 *
 * TODO 2B-bis: integrare Capacitor Geolocation, gestire permessi, aggiornare
 *   marker via setLatLng() ad ogni positionchange.
 * TODO 2C: caricare quest mock e renderizzare marker/zone.
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class HomePage implements AfterViewInit, OnDestroy {
  // Riferimento al div che ospitera' la mappa.
  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  // Istanza Leaflet. Privata, mai esposta al template.
  private map: L.Map | null = null;

  // Marker della posizione utente. Salvato come campo perche' in 2B-bis
  // dovremo aggiornarne le coordinate dinamicamente via setLatLng().
  private userMarker: L.Marker | null = null;

  // ----------------------------------------------------------------
  // Costanti di configurazione mappa
  // ----------------------------------------------------------------

  /** Coordinate iniziali centro mappa — Trento centro. */
  private readonly INITIAL_CENTER: L.LatLngTuple = [46.0667, 11.1167];

  /**
   * Coordinate utente — Piazza Duomo Trento (mock).
   * In 2B-bis verra' sostituito da posizione reale via Capacitor Geolocation.
   */
  private readonly MOCK_USER_POSITION: L.LatLngTuple = [46.0681, 11.1211];

  /** Zoom iniziale — livello "quartiere", strade visibili. */
  private readonly INITIAL_ZOOM = 14;

  /** Zoom minimo — livello regione, copre tutto il Trentino. */
  private readonly MIN_ZOOM = 9;

  /** Zoom massimo — limite CartoDB Dark Matter. */
  private readonly MAX_ZOOM = 18;

  /**
   * Bounding box geografico entro cui l'utente puo' pannare.
   * Trentino allargato di un margine. Sud-ovest -> Nord-est.
   */
  private readonly TRENTINO_BOUNDS: L.LatLngBoundsLiteral = [
    [45.6, 10.4],
    [46.6, 12.0],
  ];

  /** URL template tile CartoDB Dark Matter. {r} = retina suffix per HiDPI. */
  private readonly TILE_URL =
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  /** Attribution obbligatoria per uso pubblico di OSM + CARTO. */
  private readonly TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>';

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  ngAfterViewInit(): void {
    this.initMap();
    this.addUserMarker();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.userMarker = null;
  }

  // ----------------------------------------------------------------
  // Inizializzazione mappa
  // ----------------------------------------------------------------

  /**
   * Crea l'istanza Leaflet sul container, applica tile e bounds.
   */
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
  }

  /**
   * Crea e aggiunge il marker della posizione utente alla mappa.
   *
   * Pattern: L.divIcon permette di passare HTML/CSS arbitrario come "icona".
   * Bypassa completamente il bug noto dei marker default Leaflet con
   * bundler moderni (path PNG non risolti).
   *
   * Lo stile del div con classe .user-marker e' definito in home.page.scss
   * dentro ::ng-deep per raggiungere gli elementi iniettati da Leaflet fuori
   * dall'albero del template Angular.
   *
   * iconSize: dimensione totale dell'area del marker (include il pulse
   * massimo) per evitare clipping durante l'animazione.
   * iconAnchor: punto del divIcon che si "ancora" alle coordinate. Centrato
   * sia in x che in y perche' il dot e' al centro del 48x48 totale.
   */
  private addUserMarker(): void {
    if (!this.map) return;

    const userIcon = L.divIcon({
      className: 'user-marker-wrapper', // wrapper esterno (no stile, solo selector)
      html: `
        <div class="user-marker">
          <div class="user-marker__pulse"></div>
          <div class="user-marker__dot"></div>
        </div>
      `,
      // 48x48 = spazio per il pulse massimo (42px) + margine.
      iconSize: [48, 48],
      // Ancora al centro: il dot e' centrato nel 48x48.
      iconAnchor: [24, 24],
    });

    this.userMarker = L.marker(this.MOCK_USER_POSITION, {
      icon: userIcon,
      // Disabilita l'interazione (per ora il marker non e' cliccabile).
      // In futuro potremmo abilitare un popup "Tu sei qui — {indirizzo}".
      interactive: false,
      keyboard: false,
    }).addTo(this.map);

    // TODO 2B-bis: in produzione, dopo Capacitor Geolocation, fare:
    //   import { Geolocation } from '@capacitor/geolocation';
    //   const watchId = await Geolocation.watchPosition({}, (pos) => {
    //     if (pos) this.userMarker?.setLatLng([pos.coords.latitude, pos.coords.longitude]);
    //   });
    //   // E in ngOnDestroy: Geolocation.clearWatch({ id: watchId });
  }
}