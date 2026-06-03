import { Component, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { SocialService } from '../../../core/services/social/social.service';

type AmiciTab = 'attivita' | 'amici' | 'settimana';

// Colori avatar deterministici per seed 0-4
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#5A8A3A,#2F4A1F)',
  'linear-gradient(135deg,#8E6314,#4A3416)',
  'linear-gradient(135deg,#5A8A3A,#2F4A1F)',
  'linear-gradient(135deg,#8E6314,#4A3416)',
  'linear-gradient(135deg,#6BA046,#2F4A1F)',
];

@Component({
  selector: 'app-amici',
  templateUrl: './amici.page.html',
  styleUrls: ['./amici.page.scss'],
  standalone: true,
  imports: [IonContent],
})
export class AmiciPage {
  private readonly socialService = inject(SocialService);

  protected readonly activeTab = signal<AmiciTab>('attivita');
  protected readonly activities = this.socialService.activities;
  protected readonly suggestions = this.socialService.suggestions;
  protected readonly friendCount = this.socialService.friendCount;

  protected readonly tabs: { id: AmiciTab; label: () => string }[] = [
    { id: 'attivita', label: () => 'Attività' },
    { id: 'amici', label: () => `Amici · ${this.friendCount()}` },
    { id: 'settimana', label: () => 'Settimana' },
  ];

  protected setTab(tab: AmiciTab): void {
    this.activeTab.set(tab);
  }

  protected avatarGradient(seed: number): string {
    return AVATAR_GRADIENTS[seed % AVATAR_GRADIENTS.length];
  }
}
