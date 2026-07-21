import { Component, Input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * A small tile that highlights a single metric: title + big value + optional
 * sublabel + optional icon. Designed to be placed in a horizontal strip above
 * a list (a future dashboard will use a grid of these).
 *
 * For currency, pass the already-formatted value (`{{ cents | money }}`) — the
 * card stays display-agnostic.
 */
@Component({
  selector: 'app-stat-card',
  imports: [FaIconComponent],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
})
export class StatCardComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) value!: string;
  @Input() sublabel?: string;
  @Input() icon?: IconDefinition;
  /** Tints the value (and icon). Useful for income/expense distinction. */
  @Input() tone: 'neutral' | 'positive' | 'negative' = 'neutral';
}
