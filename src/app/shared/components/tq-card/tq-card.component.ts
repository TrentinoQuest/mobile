import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { HapticsService } from '../../../core/services/haptics/haptics.service';

@Component({
  selector: 'tq-card',
  standalone: true,
  imports: [],
  templateUrl: './tq-card.component.html',
  styleUrl: './tq-card.component.scss',
})
export class TqCardComponent {
  @Input() tappable = false;
  @Input() elevated = false;
  @Output() tapped = new EventEmitter<void>();

  private readonly haptics = inject(HapticsService);

  handleTap(): void {
    if (!this.tappable) return;
    void this.haptics.tapLight();
    this.tapped.emit();
  }
}
