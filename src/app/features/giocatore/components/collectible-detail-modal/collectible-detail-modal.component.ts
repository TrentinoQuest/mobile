import { Component, Input, computed, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { IonIcon, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, navigateOutline } from 'ionicons/icons';
import { CollectibleRarity } from '@trentino-quest/shared-types';
import type { CollectibleEntry } from '@trentino-quest/shared-types';
import { HapticsService } from '../../../../core/services/haptics/haptics.service';
import {
  TqBadgeComponent,
  BadgeColor,
} from '../../../../shared/components/tq-badge/tq-badge.component';
import { TqButtonComponent } from '../../../../shared/components/tq-button/tq-button.component';

const PALETTES = [
  { sky: '#2A3A4A', mid: '#1A2F40', fg: '#0D1A24' },
  { sky: '#3A2A18', mid: '#3A2A18', fg: '#26190E' },
  { sky: '#1A2A1A', mid: '#1A3018', fg: '#0D180D' },
  { sky: '#2A1A2E', mid: '#241830', fg: '#180D20' },
  { sky: '#3A2014', mid: '#381A10', fg: '#22100A' },
  { sky: '#1A2830', mid: '#183028', fg: '#0D1C1A' },
];

type FlipPhase = 'idle' | 'out' | 'in';

@Component({
  selector: 'app-collectible-detail-modal',
  templateUrl: './collectible-detail-modal.component.html',
  styleUrls: ['./collectible-detail-modal.component.scss'],
  standalone: true,
  imports: [IonIcon, DatePipe, NgClass, TqBadgeComponent, TqButtonComponent],
})
export class CollectibleDetailModalComponent {
  private readonly modalCtrl = inject(ModalController);
  private readonly haptics = inject(HapticsService);

  @Input() entry!: CollectibleEntry;
  @Input() questName = '';
  @Input() paletteSeed = 0;

  // ── Tilt (solo durante idle) ────────────────────────────────────────────────
  private readonly tiltX = signal(0);
  private readonly tiltY = signal(0);
  private readonly shineX = signal(50);
  private readonly shineY = signal(50);

  // ── Flip (scaleX squish — nessun preserve-3d necessario) ───────────────────
  protected readonly showBack = signal(false);
  protected readonly phase = signal<FlipPhase>('idle');

  // Transform tilt: applicato solo durante idle; perspective definita nel CSS parent
  protected readonly tiltTransform = computed<string>(() => {
    if (this.phase() !== 'idle') return 'none';
    const x = this.tiltX();
    const y = this.tiltY();
    return x === 0 && y === 0 ? 'none' : `rotateX(${x}deg) rotateY(${y}deg)`;
  });

  protected readonly shineStyle = computed(() => ({
    background: `radial-gradient(circle at ${this.shineX()}% ${this.shineY()}%, rgba(255,255,255,0.22), transparent 60%)`,
  }));

  constructor() {
    addIcons({ closeOutline, navigateOutline });
  }

  protected get palette() {
    return PALETTES[this.paletteSeed % PALETTES.length];
  }

  // Classe CSS per bordo e glow rarità
  protected rarityClass(): string {
    switch (this.entry.collectible.rarity) {
      case CollectibleRarity.UNCOMMON:
        return 'cdm__card--rare';
      case CollectibleRarity.RARE:
        return 'cdm__card--epic';
      case CollectibleRarity.LEGENDARY:
        return 'cdm__card--legendary';
      default:
        return 'cdm__card--common';
    }
  }

  protected rarityBadgeColor(): BadgeColor {
    switch (this.entry.collectible.rarity) {
      case CollectibleRarity.UNCOMMON:
        return 'rare';
      case CollectibleRarity.RARE:
        return 'epic';
      case CollectibleRarity.LEGENDARY:
        return 'legendary';
      default:
        return 'common';
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.phase() !== 'idle') return;
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const nx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const ny = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    this.tiltY.set(nx * 12);
    this.tiltX.set(-ny * 8);
    this.shineX.set(50 + nx * 35);
    this.shineY.set(50 + ny * 35);
  }

  protected onPointerLeave(): void {
    this.tiltX.set(0);
    this.tiltY.set(0);
    this.shineX.set(50);
    this.shineY.set(50);
  }

  protected flipCard(): void {
    if (this.phase() !== 'idle') return;
    void this.haptics.cardFlip();
    this.tiltX.set(0);
    this.tiltY.set(0);
    this.phase.set('out');
    setTimeout(() => {
      this.showBack.update((v) => !v);
      this.phase.set('in');
      setTimeout(() => this.phase.set('idle'), 230);
    }, 200);
  }

  protected navigateTo(): void {
    const coords = this.entry.collectible.coordinates;
    if (!coords) return;
    const { lat, lng } = coords;
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_system');
  }

  protected async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }
}
