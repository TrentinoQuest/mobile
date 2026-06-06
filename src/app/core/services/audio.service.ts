import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

// Service predisposto per suoni futuri. Tutti i metodi sono no-op:
// l'infrastruttura è pronta, i file audio si aggiungono in seguito
// senza modificare i componenti.
//
// I file SFX vanno in src/assets/sounds/ come .mp3.
// Usa Howler.js quando i file sono disponibili.
@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly enabled = signal(false);

  isEnabled(): boolean {
    return this.enabled();
  }

  setEnabled(value: boolean): void {
    this.enabled.set(value);
    void Preferences.set({ key: 'soundEnabled', value: String(value) });
  }

  async loadPreference(): Promise<void> {
    const { value } = await Preferences.get({ key: 'soundEnabled' });
    this.enabled.set(value === 'true');
  }

  // Metodi predisposti — no-op finché i file non esistono
  playTap(): void { /* SFX_Click_Menu */ }
  playSuccess(): void { /* SFX_Validazione_OK */ }
  playError(): void { /* SFX_Errore_GPS */ }
  playStamp(): void { /* SFX_Timbro_Stamp */ }
  playCollectible(): void { /* SFX_Coriandoli_Jingle */ }
  playLevelUp(): void { /* SFX_LevelUp */ }
  playStreakMilestone(): void { /* SFX_Streak */ }
}
