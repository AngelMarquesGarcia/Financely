import { Component, Input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-chip',
  imports: [FaIconComponent],
  templateUrl: './chip.component.html',
  styleUrl: './chip.component.scss',
})
export class ChipComponent {
  protected readonly faTrash = faTrash;

  @Input() label = '';
  @Input() color?: string;
  @Input() emoji?: string;
  @Input() variant: 'default' | 'removable' | 'action' = 'default';
  @Input() icon?: IconDefinition;
}
