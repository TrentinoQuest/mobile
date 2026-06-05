import { Injectable, signal } from '@angular/core';

/**
 * HeadingService — direzione della bussola (dove punta il telefono).
 *
 * Sorgente: magnetometro del dispositivo via DeviceOrientation API.
 * - iOS (WKWebView): usa `webkitCompassHeading` (gia' in gradi bussola,
 *   orario da nord) e richiede un permesso esplicito su gesto utente
 *   (DeviceOrientationEvent.requestPermission).
 * - Android/altri: usa `deviceorientationabsolute` con `alpha` convertito
 *   in heading bussola.
 *
 * Espone `heading` come signal in gradi [0..360), 0 = Nord, 90 = Est.
 * Il valore e' filtrato con un passa-basso angolare per ridurre il jitter
 * del magnetometro (importante per non far "tremare" la mappa quando la si
 * ruota con la bussola).
 *
 * E' un dato "best effort": se il sensore non e' disponibile o il permesso
 * viene negato, `heading` resta null e i consumatori si comportano di
 * conseguenza (niente cono direzione, niente rotazione mappa).
 */
@Injectable({ providedIn: 'root' })
export class HeadingService {
  private readonly _heading = signal<number | null>(null);
  /** Direzione bussola in gradi [0..360), 0 = Nord. null se non disponibile. */
  readonly heading = this._heading.asReadonly();

  private readonly _active = signal(false);
  /** true quando stiamo effettivamente ricevendo eventi dal sensore. */
  readonly active = this._active.asReadonly();

  private listening = false;
  private smoothed: number | null = null;
  private readonly handler = (e: DeviceOrientationEvent): void => this.onOrientation(e);

  /**
   * Avvia l'ascolto della bussola. Va invocato da un gesto utente su iOS
   * (per il prompt di permesso). Ritorna true se l'ascolto e' partito.
   * Idempotente.
   */
  async start(): Promise<boolean> {
    if (this.listening) return true;
    if (typeof window === 'undefined') return false;

    // iOS 13+: permesso esplicito richiesto su gesto utente.
    const orientationEvent = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof orientationEvent.requestPermission === 'function') {
      try {
        const res = await orientationEvent.requestPermission();
        if (res !== 'granted') return false;
      } catch {
        return false;
      }
    }

    // Preferiamo l'evento "absolute" (riferito al nord magnetico reale).
    // Const locale: evita che il narrowing di `in` restringa il tipo di window.
    const hasAbsolute = 'ondeviceorientationabsolute' in window;
    if (hasAbsolute) {
      window.addEventListener('deviceorientationabsolute', this.handler as EventListener, true);
    } else {
      window.addEventListener('deviceorientation', this.handler, true);
    }

    this.listening = true;
    return true;
  }

  /** Ferma l'ascolto e azzera lo stato (es. all'uscita dalla mappa). */
  stop(): void {
    if (!this.listening) return;
    window.removeEventListener('deviceorientationabsolute', this.handler as EventListener, true);
    window.removeEventListener('deviceorientation', this.handler, true);
    this.listening = false;
    this._active.set(false);
    this.smoothed = null;
    this._heading.set(null);
  }

  private onOrientation(e: DeviceOrientationEvent): void {
    let heading: number | null = null;

    // iOS: heading bussola pronto all'uso (orario da nord).
    const iosHeading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
    if (typeof iosHeading === 'number' && !Number.isNaN(iosHeading)) {
      heading = iosHeading;
    } else if (e.alpha != null) {
      // alpha: rotazione attorno a z in senso antiorario → converto in bussola.
      heading = 360 - e.alpha;
    }

    if (heading == null) return;
    heading = ((heading % 360) + 360) % 360;

    // Passa-basso angolare (gestisce il wrap-around 359→0).
    this.smoothed = this.smoothAngle(this.smoothed, heading, 0.18);
    this._heading.set(Math.round(this.smoothed));
    if (!this._active()) this._active.set(true);
  }

  /** Media esponenziale tra due angoli, prendendo la via piu' corta. */
  private smoothAngle(prev: number | null, next: number, alpha: number): number {
    if (prev == null) return next;
    let delta = next - prev;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return (((prev + alpha * delta) % 360) + 360) % 360;
  }
}
