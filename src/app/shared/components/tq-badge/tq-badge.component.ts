import { Component, Input } from '@angular/core';

export type BadgeColor =
  | 'primary'
  | 'accent'
  | 'success'
  | 'error'
  | 'warning'
  | 'xp'
  | 'common'
  | 'rare'
  | 'epic'
  | 'legendary';

@Component({
  selector: 'tq-badge',
  standalone: true,
  imports: [],
  templateUrl: './tq-badge.component.html',
  styleUrl: './tq-badge.component.scss',
})
export class TqBadgeComponent {
  @Input() color: BadgeColor = 'primary';
  @Input() size: 'sm' | 'md' = 'md';
}
