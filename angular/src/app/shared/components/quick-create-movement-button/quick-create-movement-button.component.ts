import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { take } from 'rxjs';
import { DialogService } from '../../../core/services/dialog.service';
import { DataRefreshService } from '../../../core/services/data-refresh.service';
import { MovementFormComponent } from '../../../features/movements/movement-form/movement-form.component';

/**
 * Opens the `MovementFormComponent` in a dialog for quick movement creation
 * from anywhere — navbar, dashboard, an envelope detail, etc. Emits `(created)`
 * after the dialog closes so the host can refresh its own data if needed.
 *
 * Customizable via `[label]`, `[buttonClass]`, `[icon]` for different contexts
 * (icon-only navbar button vs. full-text dashboard CTA).
 */
@Component({
  selector: 'app-quick-create-movement-button',
  imports: [FaIconComponent],
  template: `
    <button type="button" [class]="buttonClass" (click)="open()">
      @if (icon) {
        <fa-icon [icon]="icon" />
      }
      @if (label) {
        <span class="qcm-label">{{ label }}</span>
      }
    </button>
  `,
  styles: [`
    :host { display: inline-block; }
    .qcm-label { margin-left: 0.375rem; }
  `],
})
export class QuickCreateMovementButtonComponent {
  private dialog = inject(DialogService);
  private refresh = inject(DataRefreshService);

  @Input() label = 'Add movement';
  @Input() buttonClass = 'btn btn--primary';
  @Input() icon: IconDefinition | undefined = faPlus;
  @Output() created = new EventEmitter<void>();

  open() {
    this.dialog
      .open<MovementFormComponent, undefined, void>(MovementFormComponent)
      .afterClosed()
      .pipe(take(1))
      .subscribe(() => {
        this.created.emit();
        // Fired from anywhere (e.g. the navbar) — signal balance views to reload even though the
        // host page never navigated.
        this.refresh.notifyMovementsChanged();
      });
  }
}
