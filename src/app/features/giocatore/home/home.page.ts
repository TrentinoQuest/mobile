import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import * as L from 'leaflet';

/**
 * Home Giocatore — vista principale mappa-centrica.
 *
 * Strategia di costruzione (per riferimento):
 * - 2A (corrente): mappa Leaflet full-bleed con tile dark warm, centrata su
 *   Trento. Niente marker, niente overlay UI. Pan/zoom funzionanti.
 * - 2B: marker della posizione utente (mock GPS) con pulse animato.
 * - 2C: mock data quest + marker sulla mappa (zone + puntuali).
 * - 2D: header overlay con collection chip + progress bar.
 * - 2E: controlli mappa flottanti (zoom, centra-su-di-me).
 * - 2F: card "Vicino a te" + bottom sheet.
 *
 * Tile provider:
 * CartoDB Dark Matter — gratis, no API key, tema dark blu-grigio che si
 * fonde col nostro background warm-dark. Attribution obbligatoria mostrata
 * automaticamente da Leaflet in basso a destra.
 *
 * Centro mappa (2A — mock):
 * Trento centro, lat 46.0667 / lng 11.1167, zoom 14 (livello "quartiere").
 * Il GPS reale arriva in 2B via Capacitor Geolocation.
 *
 * Lifecycle:
 * - ngAfterViewInit: il DOM e' pronto e #mapContainer ha dimensioni
 * - ngOnDestroy: rimuove la mappa per evitare memory leak su navigazione
 *
 * TODO 2B: integrare Capacitor Geolocation, gestire permessi, marker user.
 * TODO 2C: caricare quest mock e renderizzare marker/zone.
 * TODO performance: se in test scopriamo "mappa grigia" all'inizializzazione
 *   (succede con transizioni Ionic in alcuni scenari), spostare l'init in
 *   ionViewDidEnter() o aggiungere setTimeout(0).
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
  // Tipata come L.Map | null per gestire correttamente il ciclo init/destroy.
  private map: L.Map | null = null;

  // ----------------------------------------------------------------
  // Costanti di configurazione mappa
  // ----------------------------------------------------------------

  /** Coordinate iniziali — Trento centro (mock, in 2B useremo GPS). */
  private readonly INITIAL_CENTER: L.LatLngTuple = [46.0667, 11.1167];

  /** Zoom iniziale — livello "quartiere", strade visibili. */
  private readonly INITIAL_ZOOM = 14;

  /** Zoom minimo — livello regione, copre tutto il Trentino. */
  private readonly MIN_ZOOM = 9;

  /** Zoom massimo — limite CartoDB Dark Matter. */
  private readonly MAX_ZOOM = 18;

  /**
   * Bounding box geografico entro cui l'utente puo' pannare.
   * Trentino allargato di un margine, per non frustrare l'utente che
   * trascina poco oltre il confine. Sud-ovest -> Nord-est.
   */
  private readonly TRENTINO_BOUNDS: L.LatLngBoundsLiteral = [
    [45.6, 10.4],
    [46.6, 12.0],
  ];

  /** URL template tile CartoDB Dark Matter. {s} = subdomain, {z}/{x}/{y} = tile coords. */
  private readonly TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

  /** Attribution obbligatoria per uso pubblico di OSM + CARTO. */
  private readonly TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>';

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    // Cleanup esplicito: Leaflet alloca event listener globali (resize,
    // pointer events). Senza remove() restano allocati anche dopo che
    // l'utente naviga via.
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // ----------------------------------------------------------------
  // Inizializzazione mappa
  // ----------------------------------------------------------------

  /**
   * Crea l'istanza Leaflet sul container, applica tile e bounds.
   */
  private initMap(): void {
    // Crea la mappa con configurazione iniziale.
    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.INITIAL_CENTER,
      zoom: this.INITIAL_ZOOM,
      minZoom: this.MIN_ZOOM,
      maxZoom: this.MAX_ZOOM,
      maxBounds: this.TRENTINO_BOUNDS,
      // Riduce la "viscosita'" quando l'utente trascina contro i bounds:
      // valore 1.0 = blocco rigido, 0.0 = blocco completamente molle.
      maxBoundsViscosity: 0.8,
      // Disabilitiamo i controlli di zoom default (+/- in alto a sinistra).
      // In 2E aggiungeremo i nostri pulsanti glass custom a destra.
      zoomControl: false,
      // Migliora il feel su touch: animazione di zoom piu' fluida.
      zoomAnimation: true,
      // Attribution toggle: lasciamo visibile (CartoDB richiede attribution
      // per uso pubblico). Lo stilizziamo via CSS per renderlo discreto.
      attributionControl: true,
    });

    // Aggiungi il tile layer CartoDB Dark Matter.
    L.tileLayer(this.TILE_URL, {
      attribution: this.TILE_ATTRIBUTION,
      maxZoom: this.MAX_ZOOM,
      // Subdomain rotazionali per parallelizzare il download dei tile.
      subdomains: 'abcd',
    }).addTo(this.map);
  }
}
