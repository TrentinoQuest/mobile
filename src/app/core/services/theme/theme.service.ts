import { computed, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * ThemeService — Gestione del tema visivo dell'app.
 *
 * Responsabilita':
 * - Esporre la modalita' tema scelta dall'utente come Signal reattivo
 * - Calcolare il tema effettivo risolvendo 'system' in base alla preferenza OS
 * - Persistere la scelta in Capacitor Preferences (chiave: tq_theme_mode)
 * - Applicare l'attributo data-theme su <html> per attivare le CSS custom props
 * - Reagire in tempo reale ai cambi di tema OS quando mode === 'system'
 *
 * Utilizzo: chiamare initialize() tramite provideAppInitializer in main.ts
 * prima di qualsiasi altro initializer, per evitare flash of unstyled content.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  // ===========================================================================
  // 1. COSTANTI
  // ===========================================================================

  /** Chiave Preferences per la modalita' tema scelta dall'utente. */
  private static readonly KEY_THEME_MODE = 'tq_theme_mode';

  // ===========================================================================
  // 2. STATO INTERNO
  // ===========================================================================

  /** Modalita' scelta dall'utente. Sincronizzata con Preferences. */
  private readonly _mode = signal<ThemeMode>('system');

  /**
   * Preferenza OS per il tema scuro.
   * Aggiornato dal listener matchMedia quando mode === 'system'.
   */
  private readonly _systemPrefersDark = signal<boolean>(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  // ===========================================================================
  // 3. API PUBBLICA REATTIVA
  // ===========================================================================

  /** Modalita' tema corrente: 'light' | 'dark' | 'system'. */
  readonly mode = this._mode.asReadonly();

  /**
   * Tema effettivo applicato all'app: sempre 'light' o 'dark'.
   * Risolve 'system' guardando la preferenza OS corrente.
   */
  readonly effectiveTheme = computed<'light' | 'dark'>(() => {
    const m = this._mode();
    if (m === 'system') {
      return this._systemPrefersDark() ? 'dark' : 'light';
    }
    return m;
  });

  // ===========================================================================
  // 4. API PUBBLICA
  // ===========================================================================

  /**
   * Imposta la modalita' tema, la persiste e applica immediatamente.
   *
   * @param mode Modalita' scelta dall'utente
   */
  async setMode(mode: ThemeMode): Promise<void> {
    this._mode.set(mode);
    await Preferences.set({ key: ThemeService.KEY_THEME_MODE, value: mode });
    this.applyTheme();
  }

  /**
   * Inizializza il servizio all'avvio dell'app.
   *
   * - Registra il listener matchMedia per reagire ai cambi OS
   * - Legge la preferenza salvata da Preferences
   * - Applica subito l'attributo data-theme su <html>
   *
   * Deve essere il primo provideAppInitializer in main.ts per evitare
   * che l'utente veda un flash del tema sbagliato al caricamento.
   */
  async initialize(): Promise<void> {
    // Listener OS: aggiorna il signal e riapplica solo se siamo in modalita' sistema
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (event) => {
        this._systemPrefersDark.set(event.matches);
        if (this._mode() === 'system') {
          this.applyTheme();
        }
      });
    }

    // Carica la preferenza salvata
    const { value } = await Preferences.get({ key: ThemeService.KEY_THEME_MODE });
    if (value === 'light' || value === 'dark' || value === 'system') {
      this._mode.set(value);
    }

    this.applyTheme();
  }

  // ===========================================================================
  // 5. METODI PRIVATI
  // ===========================================================================

  /** Applica il tema effettivo come attributo data-theme su <html> e aggiorna la status bar nativa. */
  private applyTheme(): void {
    const theme = this.effectiveTheme();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (Capacitor.isNativePlatform()) {
      const style = theme === 'dark' ? Style.Dark : Style.Light;
      StatusBar.setStyle({ style }).catch(() => undefined);
    }
  }
}
