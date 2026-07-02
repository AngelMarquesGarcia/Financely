import { Component, DestroyRef, EventEmitter, inject, Input, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { of, switchMap } from 'rxjs';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPlus, faRotate } from '@fortawesome/free-solid-svg-icons';
import { ConfirmService } from '../../../core/services/confirm.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ElectronService } from '../../../core/services/electron.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { AccountT, CategoryT, EnvelopeT, PeriodicMovementT } from '@shared/types';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AmountInputComponent } from '../../../shared/components/amount-input/amount-input.component';
import { PeriodicMovementFormComponent } from '../periodic-movement-form/periodic-movement-form.component';

type InstanceMode = 'current' | 'additional';

@Component({
  selector: 'app-periodic-movements-list',
  imports: [
    FormsModule,
    FaIconComponent,
    MoneyPipe,
    EmptyStateComponent,
    AmountInputComponent,
    PeriodicMovementFormComponent,
  ],
  templateUrl: './periodic-movements-list.component.html',
  styleUrl: './periodic-movements-list.component.scss',
})
export class PeriodicMovementsListComponent {
  protected readonly faPlus = faPlus;
  protected readonly faRotate = faRotate;
  @Input() templates: PeriodicMovementT[] = [];
  @Input() accounts: AccountT[] = [];
  @Input() categories: CategoryT[] = [];
  @Input() envelopes: EnvelopeT[] = [];
  @Output() changed = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private destroyRef = inject(DestroyRef);

  showForm = false;
  editingTemplate: PeriodicMovementT | null = null;

  // Inline dialog for the two manual instantiation actions.
  instanceTarget: PeriodicMovementT | null = null;
  instanceMode: InstanceMode = 'current';
  instanceDate = '';
  instanceAmountCents: number | null = null;

  categoryName(id: number): string {
    return this.categories.find((c) => c.id === id)?.name ?? '—';
  }

  envelopeName(id: number): string {
    return this.envelopes.find((e) => e.id === id)?.name ?? '—';
  }

  accountName(id: number): string {
    return this.accounts.find((a) => a.id === id)?.name ?? '—';
  }

  /** Manually triggers the catch-up generation (same call the app makes on startup). */
  sync() {
    this.electron
      .runDuePeriodicMovements()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.notify.success(
            created > 0
              ? `${created} movement${created === 1 ? '' : 's'} generated for review.`
              : 'Nothing due right now.',
          );
          this.changed.emit();
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  openCreate() {
    this.editingTemplate = null;
    this.showForm = true;
  }

  openEdit(t: PeriodicMovementT) {
    this.editingTemplate = t;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.editingTemplate = null;
  }

  onSaved() {
    this.closeForm();
    this.changed.emit();
  }

  toggleActive(t: PeriodicMovementT) {
    this.electron
      .setPeriodicMovementActive(t.id, !t.active)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notify.success(`"${t.name}" ${t.active ? 'deactivated' : 'reactivated'}.`);
          this.changed.emit();
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  deleteTemplate(t: PeriodicMovementT) {
    this.confirm
      .confirm({
        title: 'Delete periodic movement',
        message: `Delete "${t.name}"? Only templates with no generated movements can be deleted.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.deletePeriodicMovement(t.id) : of(null))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (result !== null) {
            this.notify.success(`"${t.name}" deleted.`);
            this.changed.emit();
          }
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  openInstance(t: PeriodicMovementT, mode: InstanceMode) {
    this.instanceTarget = t;
    this.instanceMode = mode;
    this.instanceDate = this.todayString();
    this.instanceAmountCents = t.quantityCents;
  }

  closeInstance() {
    this.instanceTarget = null;
  }

  submitInstance() {
    const t = this.instanceTarget;
    if (!t) return;
    if (this.instanceAmountCents == null || this.instanceAmountCents <= 0) {
      this.notify.error('Amount must be positive and non-zero.');
      return;
    }
    const date = new Date(this.instanceDate + 'T00:00:00');
    const op =
      this.instanceMode === 'current'
        ? this.electron.instantiatePeriodicMovementCurrentMonth(t.id, date, this.instanceAmountCents)
        : this.electron.createAdditionalPeriodicInstance(t.id, date, this.instanceAmountCents);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notify.success(`Instance of "${t.name}" created.`);
        this.closeInstance();
        this.changed.emit();
      },
      error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
    });
  }

  private todayString(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
}
