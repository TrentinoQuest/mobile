import { Component, Input, computed, inject, signal } from '@angular/core';
import { UpperCasePipe, DatePipe } from '@angular/common';
import { IonContent, ModalController } from '@ionic/angular/standalone';
import type { CollectibleEntry } from '@trentino-quest/shared-types';

// Palette paesaggi — hex diretti, art exception (CSS custom props non disponibili in SVG inline)
const PALETTES = [
  { skyTop: '#2A3A4A', skyBot: '#0A1520', sun: '#4A8AB0', mid: '#1A2F40', fg: '#0D1A24' },
  { skyTop: '#3A2A18', skyBot: '#121212', sun: '#C8930F', mid: '#3A2A18', fg: '#26190E' },
  { skyTop: '#1A2A1A', skyBot: '#080D08', sun: '#5A9040', mid: '#1A3018', fg: '#0D180D' },
  { skyTop: '#2A1A2E', skyBot: '#100810', sun: '#8A4AB0', mid: '#241830', fg: '#180D20' },
  { skyTop: '#3A2014', skyBot: '#140A06', sun: '#C05828', mid: '#381A10', fg: '#22100A' },
  { skyTop: '#1A2830', skyBot: '#080E12', sun: '#3A8A7A', mid: '#183028', fg: '#0D1C1A' },
];

@Component({
  selector: 'app-collectible-detail-modal',
  templateUrl: './collectible-detail-modal.component.html',
  styleUrls: ['./collectible-detail-modal.component.scss'],
  standalone: true,
  imports: [IonContent, UpperCasePipe, DatePipe],
})
export class CollectibleDetailModalComponent {
  private readonly modalCtrl = inject(ModalController);

  /** Voce della collezione da mostrare. */
  @Input() entry!: CollectibleEntry;

  /** Nome della quest che ha sbloccato questo collezionabile. */
  @Input() questName = '';

  /** Seme per la palette paesaggio (usato solo se imageUrl è vuoto). */
  @Input() paletteSeed = 0;

  // Tilt 3D
  private readonly tiltX = signal(0);
  private readonly tiltY = signal(0);
  private readonly shineX = signal(50);
  private readonly shineY = signal(50);
  private readonly settling = signal(false);

  protected get palette() {
    return PALETTES[this.paletteSeed % PALETTES.length];
  }

  protected readonly cardStyle = computed(() => ({
    transform: `perspective(700px) rotateX(${this.tiltX()}deg) rotateY(${this.tiltY()}deg)`,
    transition: this.settling()
      ? 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)'
      : 'transform 0.04s linear',
  }));

  protected readonly shineStyle = computed(() => ({
    background: `radial-gradient(circle at ${this.shineX()}% ${this.shineY()}%, rgba(255,255,255,0.16), transparent 58%)`,
  }));

  protected onPointerMove(event: PointerEvent): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const normX = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const normY = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    this.settling.set(false);
    this.tiltY.set(normX * 16);
    this.tiltX.set(-normY * 16);
    this.shineX.set(50 + normX * 35);
    this.shineY.set(50 + normY * 35);
  }

  protected onPointerLeave(): void {
    this.settling.set(true);
    this.tiltX.set(0);
    this.tiltY.set(0);
    this.shineX.set(50);
    this.shineY.set(50);
  }

  protected async dismiss(): Promise<void> {
    await this.modalCtrl.dismiss();
  }
}
