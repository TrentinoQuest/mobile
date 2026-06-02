import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, ModalController } from '@ionic/angular/standalone';
import type { ScanQrResponse } from '@trentino-quest/shared-types';
import { ScanService, type ScanError } from '../../../../core/services/scan/scan.service';
import { PlayerProfileService } from '../../../../core/services/player-profile/player-profile.service';

type ScanState = 'idle' | 'submitting' | 'success' | 'error';

// Stesse palette dell'album — art exception, hex diretti
const PALETTES = [
  { skyTop: '#2A3A4A', skyBot: '#0A1520', sun: '#4A8AB0', mid: '#1A2F40', fg: '#0D1A24' },
  { skyTop: '#3A2A18', skyBot: '#121212', sun: '#C8930F', mid: '#3A2A18', fg: '#26190E' },
  { skyTop: '#1A2A1A', skyBot: '#080D08', sun: '#5A9040', mid: '#1A3018', fg: '#0D180D' },
  { skyTop: '#2A1A2E', skyBot: '#100810', sun: '#8A4AB0', mid: '#241830', fg: '#180D20' },
  { skyTop: '#3A2014', skyBot: '#140A06', sun: '#C05828', mid: '#381A10', fg: '#22100A' },
  { skyTop: '#1A2830', skyBot: '#080E12', sun: '#3A8A7A', mid: '#183028', fg: '#0D1C1A' },
];

@Component({
  selector: 'app-scan-modal',
  templateUrl: './scan-modal.component.html',
  styleUrls: ['./scan-modal.component.scss'],
  standalone: true,
  imports: [IonContent, UpperCasePipe],
})
export class ScanModalComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly scanService = inject(ScanService);
  private readonly profileService = inject(PlayerProfileService);
  private readonly router = inject(Router);

  protected readonly state = signal<ScanState>('idle');
  protected readonly scanResult = signal<ScanQrResponse | null>(null);
  protected readonly errorMessage = signal('');

  // Palette basata sul nome del collezionabile sbloccato
  protected readonly palette = computed(() => {
    const name = this.scanResult()?.collectible?.name ?? '';
    return PALETTES[name.length % PALETTES.length];
  });

  // Contatore progressi prima e dopo lo sblocco
  protected readonly prevCount = computed(() =>
    Math.max(0, this.profileService.unlockedCount() - 0),
  );
  protected readonly totalCount = computed(() => this.profileService.totalCount());

  ngOnInit(): void {
    this.startScan();
  }

  async startScan(): Promise<void> {
    this.state.set('submitting');
    try {
      const result = await this.scanService.scanAndSubmit();
      this.scanResult.set(result);
      // Invalida cache per forzare reload alla prossima apertura album/profilo
      this.profileService.reset();
      this.state.set('success');
    } catch (err: unknown) {
      const scanErr = err as ScanError;
      if (scanErr.code === 'CANCELLED') {
        await this.dismiss();
        return;
      }
      this.errorMessage.set(scanErr.message || 'Errore sconosciuto. Riprova.');
      this.state.set('error');
    }
  }

  async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }

  async continueExploring(): Promise<void> {
    await this.modalCtrl.dismiss({ success: true });
    await this.router.navigate(['/giocatore/album']);
  }

  retryFromError(): void {
    this.startScan();
  }
}
