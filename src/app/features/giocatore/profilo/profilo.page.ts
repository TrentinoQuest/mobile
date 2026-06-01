import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { Player, UserRole } from '@trentino-quest/shared-types';
import { AuthService } from '../../../core/services/auth/auth.service';
import { PlayerProfileService } from '../../../core/services/player-profile/player-profile.service';
import { ThemeSelectorComponent } from '../../../shared/components/theme-selector/theme-selector.component';

const ITALIAN_MONTHS = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

@Component({
  selector: 'app-profilo',
  templateUrl: './profilo.page.html',
  styleUrls: ['./profilo.page.scss'],
  standalone: true,
  imports: [IonContent, DecimalPipe, ThemeSelectorComponent],
})
export class ProfiloPage {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(PlayerProfileService);
  private readonly router = inject(Router);

  protected readonly player = computed<Player | null>(() => {
    const user = this.authService.currentUser();
    if (user?.role === UserRole.PLAYER) return user as Player;
    return null;
  });

  protected readonly username = computed(() => this.player()?.username ?? 'Esploratore');
  protected readonly totalPoints = computed(() => this.player()?.totalPoints ?? 0);

  protected readonly registrationSince = computed(() => {
    const date = this.player()?.registrationDate;
    if (!date) return '';
    const d = new Date(date);
    return `${ITALIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  protected readonly level = computed(() => {
    const pts = this.totalPoints();
    if (pts >= 5000) return 5;
    if (pts >= 2000) return 4;
    if (pts >= 1000) return 3;
    if (pts >= 500) return 2;
    return 1;
  });

  protected readonly unlockedCount = this.profileService.unlockedCount;
  protected readonly totalCount = this.profileService.totalCount;

  protected readonly achievements = [
    { icon: 'mountain', label: 'Primo borgo', unlocked: true },
    { icon: 'walk', label: '50 km in cammino', unlocked: true },
    { icon: 'leaf', label: 'Esploratore', unlocked: true },
    { icon: 'flame', label: '10 giorni', unlocked: false },
    { icon: 'star', label: 'Val di Non', unlocked: false },
  ];

  protected readonly settingsRows = [
    { icon: 'bell', label: 'Notifiche', value: 'Tutti gli eventi' },
    { icon: 'layers', label: 'Mappa offline', value: '0 valli scaricate' },
    { icon: 'person', label: 'Account & privacy', value: null },
    { icon: 'compass', label: 'Lingua', value: 'Italiano' },
  ];

  protected readonly showTheme = computed(() => false);

  ionViewWillEnter(): void {
    this.profileService.loadProgress();
    this.profileService.loadCollection();
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/']);
  }

  // Icone SVG inline per gli achievement (evita import dinamici)
  protected achievementIcon(name: string): string {
    const icons: Record<string, string> = {
      mountain: 'M3 20l5-9 3 5 2-3 8 7H3z',
      walk: 'M13 4.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM9 21l2-6-3-3 2-4 4 1 3 3M14 12l3 2v6',
      leaf: 'M4 20c0-9 7-16 16-16 0 9-7 16-16 16zM4 20c4-4 8-8 16-16',
      flame: 'M12 3s-1 3-3 5-3 4-3 7a6 6 0 0012 0c0-2.5-1.5-4-2.5-6S13.5 6 12 3z',
      star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z',
    };
    return icons[name] ?? 'M12 12m-9 0a9 9 0 1018 0 9 9 0 00-18 0';
  }
}
