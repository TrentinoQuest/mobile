import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { HapticsService } from '../../../core/services/haptics/haptics.service';
import { AudioService } from '../../../core/services/audio.service';

@Component({
  selector: 'tq-button',
  standalone: true,
  imports: [IonIcon, IonSpinner],
  templateUrl: './tq-button.component.html',
  styleUrl: './tq-button.component.scss',
})
export class TqButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'ghost' = 'primary';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() inverted = false; // bottone bianco su sfondo scuro
  @Input() iconStart?: string;
  @Input() iconEnd?: string;
  @Output() tapped = new EventEmitter<void>();

  private readonly haptics = inject(HapticsService);
  private readonly audio = inject(AudioService);

  handleTap(): void {
    if (this.disabled || this.loading) return;
    switch (this.variant) {
      case 'primary':
        void this.haptics.tapHeavy();
        break;
      case 'secondary':
        void this.haptics.tapMedium();
        break;
      case 'ghost':
        void this.haptics.tapLight();
        break;
    }
    this.audio.playTap();
    this.tapped.emit();
  }
}
