import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EntitySelectComponent } from '../../../shared/components/entity-select/entity-select.component';
import { AmountInputComponent } from '../../../shared/components/amount-input/amount-input.component';
import { forkJoin, of, switchMap } from 'rxjs';
import { ElectronService } from '../../../core/services/electron.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { AccountT, CategoryT, EnvelopeT } from '@shared/types';

@Component({
  selector: 'app-envelope-form',
  imports: [FormsModule, EntitySelectComponent, AmountInputComponent],
  templateUrl: './envelope-form.component.html',
  styleUrl: './envelope-form.component.scss',
})
export class EnvelopeFormComponent implements OnChanges {
  @Input() editingEnvelope: EnvelopeT | null = null;
  @Input() accounts: AccountT[] = [];
  @Input() categories: CategoryT[] = [];
  @Input() envelopes: EnvelopeT[] = [];
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private destroyRef = inject(DestroyRef);

  name = '';
  accountId: number | null = null;
  startingBalance = 0;
  budgetCents: number | null = null;
  maxSavingsCents: number | null = null;
  maxSavingsMode: 'none' | '1x' | '2x' | '3x' | 'custom' = 'none';
  overflowsTo: number | null = null;
  selectedCategoryIds: number[] = [];
  showErrors = false;

  /** Over-cap redirect targets: other envelopes in the selected account. */
  get overflowTargets(): EnvelopeT[] {
    if (this.accountId == null) return [];
    return this.envelopes.filter(
      (e) => e.accountId === this.accountId && e.id !== this.editingEnvelope?.id,
    );
  }

  readonly categoryLabel = (c: CategoryT) => c.name;
  readonly categoryColor = (c: CategoryT) => c.color ?? undefined;
  readonly categoryEmoji = (c: CategoryT) => c.emoji ?? undefined;
  readonly categoryAvailable = (c: CategoryT) =>
    c.envelopeId == null || c.envelopeId === this.editingEnvelope?.id;

  get isEditing() {
    return this.editingEnvelope !== null;
  }

  /** Multiplier modes derive the cap from the current budget; custom/none keep their own value. */
  onBudgetChange(value: number | null) {
    this.budgetCents = value;
    if (this.maxSavingsMode !== 'none' && this.maxSavingsMode !== 'custom') {
      this.recomputeMaxSavings();
    }
  }

  onMaxSavingsModeChange() {
    this.recomputeMaxSavings();
  }

  private recomputeMaxSavings() {
    if (this.maxSavingsMode === 'none') {
      this.maxSavingsCents = null;
    } else if (this.maxSavingsMode !== 'custom') {
      const multiplier = Number(this.maxSavingsMode[0]); // '2x' → 2
      this.maxSavingsCents = this.budgetCents != null ? this.budgetCents * multiplier : null;
    }
    // 'custom' keeps whatever the amount input holds.
  }

  private inferMaxSavingsMode(
    maxSavingsCents: number | null,
    budgetCents: number | null,
  ): 'none' | '1x' | '2x' | '3x' | 'custom' {
    if (maxSavingsCents == null) return 'none';
    if (budgetCents != null && budgetCents > 0 && maxSavingsCents % budgetCents === 0) {
      const multiplier = maxSavingsCents / budgetCents;
      if (multiplier >= 1 && multiplier <= 3) return `${multiplier}x` as '1x' | '2x' | '3x';
    }
    return 'custom';
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['editingEnvelope'] || changes['categories']) {
      this.name = this.editingEnvelope?.name ?? '';
      this.accountId = this.editingEnvelope?.accountId ?? null;
      this.startingBalance = this.editingEnvelope?.startingBalance ?? 0;
      this.budgetCents = this.editingEnvelope?.budgetCents ?? null;
      this.maxSavingsCents = this.editingEnvelope?.maxSavingsCents ?? null;
      this.maxSavingsMode = this.inferMaxSavingsMode(this.maxSavingsCents, this.budgetCents);
      this.overflowsTo = this.editingEnvelope?.overflowsTo ?? null;
      this.selectedCategoryIds = this.editingEnvelope
        ? this.categories.filter((c) => c.envelopeId === this.editingEnvelope!.id).map((c) => c.id)
        : [];
    }
  }

  private syncCategories(envelopeId: number) {
    const previousIds = this.categories.filter((c) => c.envelopeId === envelopeId).map((c) => c.id);
    const toAdd = this.selectedCategoryIds.filter((id) => !previousIds.includes(id));
    const toRemove = previousIds.filter((id) => !this.selectedCategoryIds.includes(id));
    const ops = [
      ...toAdd.map((id) => {
        const cat = this.categories.find((c) => c.id === id)!;
        return this.electron.updateCategory({ ...cat, envelopeId });
      }),
      ...toRemove.map((id) => {
        const cat = this.categories.find((c) => c.id === id)!;
        return this.electron.updateCategory({ ...cat, envelopeId: null });
      }),
    ];
    return ops.length ? forkJoin(ops) : of(null);
  }

  save() {
    this.showErrors = true;
    if (!this.name.trim() || !this.accountId) return;

    if (this.isEditing) {
      const envelopeId = this.editingEnvelope!.id;
      this.electron
        .updateEnvelope({
          id: envelopeId,
          name: this.name,
          accountId: this.accountId,
          isDefault: this.editingEnvelope!.isDefault,
          startingBalance: this.startingBalance,
          budgetCents: this.budgetCents,
          maxSavingsCents: this.maxSavingsCents,
          overflowsTo: this.overflowsTo,
        })
        .pipe(
          switchMap(() => this.syncCategories(envelopeId)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: () => this.saved.emit(),
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    } else {
      this.electron
        .createEnvelope(
          this.name,
          this.accountId,
          this.startingBalance || undefined,
          this.budgetCents,
          this.maxSavingsCents,
          this.overflowsTo,
        )
        .pipe(
          switchMap((newId) => {
            const envelopeId = Number(newId);
            const ops = this.selectedCategoryIds.map((id) => {
              const cat = this.categories.find((c) => c.id === id)!;
              return this.electron.updateCategory({ ...cat, envelopeId });
            });
            return ops.length ? forkJoin(ops) : of(null);
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: () => {
            this.saved.emit();
            this.name = '';
            this.accountId = null;
            this.startingBalance = 0;
            this.budgetCents = null;
            this.maxSavingsCents = null;
            this.maxSavingsMode = 'none';
            this.overflowsTo = null;
            this.selectedCategoryIds = [];
            this.showErrors = false;
          },
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    }
  }

  cancel() {
    this.cancelled.emit();
  }
}
