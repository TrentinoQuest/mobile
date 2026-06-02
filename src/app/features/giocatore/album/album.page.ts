import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { IonContent } from '@ionic/angular/standalone';
import { CollectibleRarity } from '@trentino-quest/shared-types';
import { PlayerProfileService } from '../../../core/services/player-profile/player-profile.service';

type AlbumFilter = 'tutti' | 'area' | 'crono' | 'da-scoprire';

interface AlbumCard {
  id: string;
  name: string;
  locked: boolean;
  paletteSeed: number;
  imageUrl: string;
  rarity: CollectibleRarity | null;
}

@Component({
  selector: 'app-album',
  templateUrl: './album.page.html',
  styleUrls: ['./album.page.scss'],
  standalone: true,
  imports: [IonContent, NgClass],
})
export class AlbumPage implements OnInit {
  private readonly profileService = inject(PlayerProfileService);

  protected readonly loading = this.profileService.loading;
  protected readonly error = this.profileService.error;
  protected readonly unlockedCount = this.profileService.unlockedCount;
  protected readonly totalCount = this.profileService.totalCount;

  protected readonly activeFilter = signal<AlbumFilter>('tutti');

  protected readonly filters: { id: AlbumFilter; label: string }[] = [
    { id: 'tutti', label: 'Tutti' },
    { id: 'area', label: 'Per area' },
    { id: 'crono', label: 'Cronologia' },
    { id: 'da-scoprire', label: 'Da scoprire' },
  ];

  // Palette paesaggi per le card collezionabili — hex diretti (art decorativa)
  protected readonly PALETTES = [
    { sky: '#3B2E1E', mid: '#5A4A28', fg: '#C8930F' },
    { sky: '#1F2D2A', mid: '#2E4A34', fg: '#6BA046' },
    { sky: '#2A2118', mid: '#4A3924', fg: '#8E6314' },
    { sky: '#1B2530', mid: '#2C3D4E', fg: '#7B92A0' },
    { sky: '#3A2A1F', mid: '#5C4128', fg: '#D4A23A' },
    { sky: '#1A2924', mid: '#2C4035', fg: '#5A8A3A' },
  ];

  protected readonly displayedCards = computed<AlbumCard[]>(() => {
    const col = this.profileService.collection();
    const total = this.totalCount();
    const filter = this.activeFilter();

    if (filter === 'da-scoprire') {
      const lockedCount = Math.max(0, total - col.length);
      return Array.from({ length: lockedCount }, (_, i) => ({
        id: `locked-${i}`,
        name: '',
        locked: true,
        paletteSeed: i,
        imageUrl: '',
        rarity: null,
      }));
    }

    let entries = [...col];
    if (filter === 'crono') {
      entries = entries.sort(
        (a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime(),
      );
    }

    const unlocked: AlbumCard[] = entries.map((entry, i) => ({
      id: entry.collectible.id,
      name: entry.collectible.name,
      locked: false,
      paletteSeed: i,
      imageUrl: entry.collectible.imageUrl ?? '',
      rarity: entry.collectible.rarity,
    }));

    // TODO: "Per area" richiede campo zone sul Collectible — per ora mostra tutto
    if (filter === 'crono' || filter === 'area') return unlocked;

    const lockedCount = Math.max(0, total - col.length);
    const locked: AlbumCard[] = Array.from({ length: lockedCount }, (_, i) => ({
      id: `locked-${i}`,
      name: '',
      locked: true,
      paletteSeed: col.length + i,
      imageUrl: '',
      rarity: null,
    }));

    return [...unlocked, ...locked];
  });

  protected readonly progressPercent = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.unlockedCount() / total) * 100));
  });

  protected readonly CIRCUMFERENCE = 2 * Math.PI * 38;

  protected readonly strokeDashoffset = computed(
    () => this.CIRCUMFERENCE * (1 - this.progressPercent() / 100),
  );

  protected palette(seed: number) {
    return this.PALETTES[seed % this.PALETTES.length];
  }

  protected readonly CollectibleRarity = CollectibleRarity;

  protected cardNum(index: number): string {
    return `#${String(index * 7 + 12).padStart(3, '0')}`;
  }

  protected rarityModifier(rarity: CollectibleRarity | null): string {
    return rarity ? `album__card-rarity--${rarity}` : '';
  }

  ngOnInit(): void {
    this.profileService.loadCollection();
    this.profileService.loadProgress();
  }

  protected setFilter(filter: AlbumFilter): void {
    this.activeFilter.set(filter);
  }
}
