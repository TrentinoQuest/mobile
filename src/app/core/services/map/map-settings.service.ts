import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * MapSettingsService — preferenze di gioco relative alla mappa.
 *
 * Persistite in Capacitor Preferences, esposte come signal reattivi cosi'
 * la Home reagisce in tempo reale al cambio dalle impostazioni del profilo.
 *
 * Per ora una sola opzione: `rotateWithHeading` — ruota la mappa seguendo la
 * direzione reale della bussola (modalita' "in avanti", stile navigatore),
 * invece di tenere il nord sempre in alto.
 */
@Injectable({ providedIn: 'root' })
export class MapSettingsService {
  private static readonly KEY_ROTATE_HEADING = 'tq_map_rotate_heading';

  private readonly _rotateWithHeading = signal(false);
  /** Se true la mappa ruota con la bussola del telefono. */
  readonly rotateWithHeading = this._rotateWithHeading.asReadonly();

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const { value } = await Preferences.get({ key: MapSettingsService.KEY_ROTATE_HEADING });
    if (value === 'true') this._rotateWithHeading.set(true);
  }

  /** Imposta e persiste la rotazione mappa con la bussola. */
  async setRotateWithHeading(enabled: boolean): Promise<void> {
    this._rotateWithHeading.set(enabled);
    await Preferences.set({
      key: MapSettingsService.KEY_ROTATE_HEADING,
      value: String(enabled),
    });
  }
}
