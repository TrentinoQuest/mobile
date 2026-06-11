import { Component, inject } from '@angular/core';
import {
  IonSegment,
  IonSegmentButton,
  IonLabel,
  SegmentCustomEvent,
} from '@ionic/angular/standalone';
import { ThemeService, ThemeMode } from '../../../core/services/theme/theme.service';

/**
 * Selettore tema — segmented control con tre opzioni: Chiaro, Scuro, Sistema.
 *
 * Legge la modalita' corrente dal ThemeService e la aggiorna al cambio
 * senza richiedere un pulsante di conferma.
 */
@Component({
  selector: 'app-theme-selector',
  templateUrl: './theme-selector.component.html',
  styleUrls: ['./theme-selector.component.scss'],
  standalone: true,
  imports: [IonSegment, IonSegmentButton, IonLabel],
})
export class ThemeSelectorComponent {
  protected readonly themeService = inject(ThemeService);

  /** Aggiorna la modalita' tema al cambio del segmented control. */
  protected async onModeChange(event: SegmentCustomEvent): Promise<void> {
    const value = event.detail.value as ThemeMode;
    if (value === 'light' || value === 'dark' || value === 'system') {
      await this.themeService.setMode(value);
    }
  }
}
