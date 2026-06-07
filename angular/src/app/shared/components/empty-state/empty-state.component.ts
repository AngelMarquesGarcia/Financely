import { Component, Input } from '@angular/core';

/**
 * Empty-state placeholder. Renders a centered message with an optional emoji icon
 * and an optional projected CTA (button, link, anything inside the host tag).
 *
 * Usage:
 *   <app-empty-state message="No tags yet" icon="🏷️">
 *     <button class="btn btn--primary" (click)="openForm()">Create your first tag</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty">
      @if (icon) { <span class="empty__icon">{{ icon }}</span> }
      <p class="empty__message">{{ message }}</p>
      <ng-content />
    </div>
  `,
  styles: [`
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      color: var(--c-text-muted);
      font-size: 0.875rem;
    }
    .empty__icon { font-size: 1.75rem; }
    .empty__message { margin: 0; }
  `],
})
export class EmptyStateComponent {
  @Input({ required: true }) message!: string;
  @Input() icon?: string;
}
