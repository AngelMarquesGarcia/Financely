import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { AccountT, CategoryT, EnvelopeT, PeriodicMovementT, TagT } from '@shared/types';
import { TagPickerComponent } from '../../../shared/components/tag-picker/tag-picker.component';
import { AmountInputComponent } from '../../../shared/components/amount-input/amount-input.component';
import { EnvelopeSplitEditorComponent } from '../../../shared/components/envelope-split-editor/envelope-split-editor.component';

@Component({
  selector: 'app-periodic-movement-form',
  imports: [FormsModule, TagPickerComponent, AmountInputComponent, EnvelopeSplitEditorComponent],
  templateUrl: './periodic-movement-form.component.html',
  styleUrl: './periodic-movement-form.component.scss',
})
export class PeriodicMovementFormComponent implements OnInit, OnChanges {
  @Input() editingTemplate: PeriodicMovementT | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private destroyRef = inject(DestroyRef);

  accounts: AccountT[] = [];
  categories: CategoryT[] = [];
  envelopes: EnvelopeT[] = [];
  tags: TagT[] = [];

  name = '';
  concept: string | null = null;
  amountCents: number | null = null;
  type: 'income' | 'expense' = 'expense';
  dayOfMonth = 1;
  selectedAccountId: number | null = null;
  selectedCategoryName = '';
  selectedCategoryId: number | null = null;
  selectedEnvelopeId: number | null = null;
  selectedTagIds: number[] = [];
  additionalNotes: string | null = null;

  /** Split-across-envelopes mode (CU3). The default split is copied onto every generated instance. */
  splitMode = false;
  splitMap = new Map<number, number>();
  splitValid = false;
  initialSplit: Map<number, number> | null = null;

  showErrors = false;

  get isEditing() {
    return this.editingTemplate !== null;
  }

  get validationErrors(): string[] {
    const errors: string[] = [];
    if (!this.name.trim()) errors.push('Name is required.');
    if (this.amountCents == null || this.amountCents <= 0) errors.push('Amount must be positive.');
    if (!Number.isInteger(this.dayOfMonth) || this.dayOfMonth < 1 || this.dayOfMonth > 31)
      errors.push('Day must be between 1 and 31.');
    if (!this.selectedAccountId) errors.push('An account must be selected.');
    if (this.splitMode) {
      if (!this.splitValid) errors.push('Split amounts must add up to the total.');
    } else if (!this.selectedEnvelopeId) {
      errors.push('An envelope must be selected.');
    }
    if (!this.selectedCategoryId) errors.push('A category must be selected.');
    return errors;
  }

  get isValid(): boolean {
    return this.validationErrors.length === 0;
  }

  ngOnInit() {
    this.electron
      .getAllAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accs) => {
          this.accounts = accs;
          if (!this.isEditing && !this.selectedAccountId) {
            this.selectedAccountId = accs.find((a) => a.isDefault)?.id ?? null;
          }
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
    this.electron
      .getAllCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cats) => (this.categories = cats),
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
    this.electron
      .getAllEnvelopes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (envs) => {
          this.envelopes = envs;
          if (!this.isEditing && !this.selectedEnvelopeId) {
            this.selectedEnvelopeId = envs.find((e) => e.isDefault)?.id ?? null;
          }
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
    this.electron
      .getAllTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => (this.tags = tags),
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['editingTemplate']) {
      const t = this.editingTemplate;
      if (t) {
        this.name = t.name;
        this.concept = t.concept;
        this.amountCents = t.quantityCents;
        this.type = t.isPositive ? 'income' : 'expense';
        this.dayOfMonth = t.dayOfMonth;
        this.selectedAccountId = t.accountId;
        this.selectedCategoryId = t.categoryId;
        this.selectedCategoryName = this.categories.find((c) => c.id === t.categoryId)?.name ?? '';
        if (t.envelopeIdMap.size > 1) {
          this.splitMode = true;
          this.initialSplit = t.envelopeIdMap;
          this.selectedEnvelopeId = null;
        } else {
          this.splitMode = false;
          this.initialSplit = null;
          this.selectedEnvelopeId = [...t.envelopeIdMap.keys()][0] ?? null;
        }
        this.additionalNotes = t.additionalNotes;
        this.showErrors = false;
        this.electron
          .getTagsForPeriodicMovement(t.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (tags) => (this.selectedTagIds = tags.map((x) => x.id)),
            error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
          });
      } else {
        this.reset();
      }
    }
  }

  onCategorySelected() {
    this.selectedCategoryId =
      this.categories.find((c) => c.name === this.selectedCategoryName)?.id ?? null;
  }

  onTagPickerTagCreated() {
    this.electron
      .getAllTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => (this.tags = tags),
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  save() {
    this.showErrors = true;
    if (!this.isValid) return;

    const quantityCents = this.amountCents!;
    const envelopeIdMap = this.splitMode
      ? this.splitMap
      : new Map([[this.selectedEnvelopeId!, quantityCents]]);
    const fields = {
      accountId: this.selectedAccountId!,
      name: this.name.trim(),
      concept: this.concept || null,
      quantityCents,
      isPositive: this.type === 'income',
      dayOfMonth: this.dayOfMonth,
      categoryId: this.selectedCategoryId!,
      envelopeIdMap,
      additionalNotes: this.additionalNotes || null,
    };

    const op: Observable<unknown> = this.isEditing
      ? this.electron.updatePeriodicMovement(
          { ...this.editingTemplate!, ...fields },
          this.selectedTagIds,
        )
      : this.electron.createPeriodicMovement(fields, this.selectedTagIds);

    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saved.emit();
        if (!this.isEditing) this.reset();
      },
      error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
    });
  }

  cancel() {
    this.cancelled.emit();
  }

  private reset() {
    this.name = '';
    this.concept = null;
    this.amountCents = null;
    this.type = 'expense';
    this.dayOfMonth = 1;
    this.selectedAccountId = this.accounts.find((a) => a.isDefault)?.id ?? null;
    this.selectedCategoryName = '';
    this.selectedCategoryId = null;
    this.selectedEnvelopeId = this.envelopes.find((e) => e.isDefault)?.id ?? null;
    this.splitMode = false;
    this.splitMap = new Map();
    this.splitValid = false;
    this.initialSplit = null;
    this.selectedTagIds = [];
    this.additionalNotes = null;
    this.showErrors = false;
  }
}
