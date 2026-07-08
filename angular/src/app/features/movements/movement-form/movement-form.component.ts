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
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { forkJoin, of, switchMap, take } from 'rxjs';
import { ConfirmService } from '../../../core/services/confirm.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ElectronService } from '../../../core/services/electron.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { DialogService } from '../../../core/services/dialog.service';
import { DialogRef } from '../../../core/services/dialog-ref';
import { CategoryT, EnvelopeT, MovementT, TagT } from '@shared/types';
import { TagPickerComponent } from '../../../shared/components/tag-picker/tag-picker.component';
import { SettingsComponent } from '../../settings/settings.component';
import { AmountInputComponent } from '../../../shared/components/amount-input/amount-input.component';
import { AutocompleteInputComponent } from '../../../shared/components/autocomplete-input/autocomplete-input.component';
import { EnvelopeSplitEditorComponent } from '../../../shared/components/envelope-split-editor/envelope-split-editor.component';

@Component({
  selector: 'app-movement-form',
  imports: [
    FormsModule,
    FaIconComponent,
    TagPickerComponent,
    AmountInputComponent,
    AutocompleteInputComponent,
    EnvelopeSplitEditorComponent,
  ],
  templateUrl: './movement-form.component.html',
  styleUrl: './movement-form.component.scss',
})
export class MovementFormComponent implements OnInit, OnChanges {
  protected readonly faGear = faGear;
  @Input() editingMovement: MovementT | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private confirmService = inject(ConfirmService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private dialog = inject(DialogService);
  private destroyRef = inject(DestroyRef);
  /** Present when the form is opened as a CDK dialog (quick-create flow). */
  protected dialogRef = inject(DialogRef<void>, { optional: true });

  private useDefaultDate = false;
  private loadedDefaultDate = '';

  categories: CategoryT[] = [];
  envelopes: EnvelopeT[] = [];
  tags: TagT[] = [];

  name = '';
  concept: string | null = null;
  /** Integer cents, or null when empty. Managed by `<app-amount-input>`. */
  amountCents: number | null = null;
  type: 'income' | 'expense' = 'expense';
  date = '';
  selectedCategoryName = '';
  selectedCategoryId: number | null = null;
  selectedEnvelopeId: number | null = null;
  selectedTagIds: number[] = [];
  additionalNotes: string | null = null;
  /** User-owned. Excluded from without-anomaly statistics; never affects balances. */
  isAnomalous = false;

  /** Split-across-envelopes mode (CU3). When on, the split editor drives envelope attribution. */
  splitMode = false;
  /** The latest allocation emitted by the split editor, and whether it sums to the total. */
  splitMap = new Map<number, number>();
  splitValid = false;
  /** Allocation to seed the editor with when editing an existing split. */
  initialSplit: Map<number, number> | null = null;

  private currentTagIds: number[] = [];
  showErrors = false;

  get isEditing() {
    return this.editingMovement !== null;
  }

  /**
   * Async lookup for the name autocomplete. Bound by arrow-field so the
   * template can pass it as an input without losing `this`.
   */
  readonly suggestNames = (prefix: string) => this.electron.suggestMovementNames(prefix);

  get validationErrors(): string[] {
    const errors: string[] = [];
    if (!this.name.trim()) errors.push('Name is required.');
    if (this.amountCents == null || this.amountCents <= 0) {
      errors.push('Amount must be positive and non-zero.');
    }
    if (this.splitMode) {
      if (!this.splitValid) errors.push('Split amounts must add up to the total.');
    } else if (!this.selectedEnvelopeId) {
      errors.push('An envelope must be selected.');
    }
    if (this.date > this.todayString()) errors.push('Date cannot be in the future.');
    if (!this.selectedCategoryId) errors.push('A category must be selected.');
    return errors;
  }

  get isValid(): boolean {
    return this.validationErrors.length === 0;
  }

  ngOnInit() {
    this.date = this.todayString();
    this.electron
      .getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.useDefaultDate = s.useDefaultDate ?? false;
          this.loadedDefaultDate = s.defaultDate ?? '';
          if (!this.isEditing) {
            this.date = this.useDefaultDate && this.loadedDefaultDate
              ? this.loadedDefaultDate
              : this.todayString();
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
    if (changes['editingMovement']) {
      const m = this.editingMovement;
      if (m) {
        this.name = m.name;
        this.concept = m.concept;
        this.amountCents = m.quantityCents;
        this.type = m.isPositive ? 'income' : 'expense';
        this.date =
          m.date instanceof Date ? this.dateToInput(m.date) : String(m.date).substring(0, 10);
        const cat = this.categories.find((c) => c.id === m.categoryId);
        this.selectedCategoryName = cat?.name ?? '';
        this.selectedCategoryId = m.categoryId;
        if (m.envelopeIdMap.size > 1) {
          this.splitMode = true;
          this.initialSplit = m.envelopeIdMap;
          this.selectedEnvelopeId = null;
        } else {
          this.splitMode = false;
          this.initialSplit = null;
          this.selectedEnvelopeId = [...m.envelopeIdMap.keys()][0] ?? null;
        }
        this.additionalNotes = m.additionalNotes;
        this.isAnomalous = m.isAnomalous;
        this.showErrors = false;
        this.electron
          .getTagsForMovement(m.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (tags) => {
              this.currentTagIds = tags.map((t) => t.id);
              this.selectedTagIds = [...this.currentTagIds];
            },
            error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
          });
      } else {
        this.reset();
      }
    }
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

  onCategorySelected() {
    const cat = this.categories.find((c) => c.name === this.selectedCategoryName);
    this.selectedCategoryId = cat?.id ?? null;
  }

  toggleTag(id: number) {
    const idx = this.selectedTagIds.indexOf(id);
    if (idx >= 0) {
      this.selectedTagIds.splice(idx, 1);
    } else {
      this.selectedTagIds.push(id);
    }
  }

  isTagSelected(id: number): boolean {
    return this.selectedTagIds.includes(id);
  }

  save() {
    if (this.selectedCategoryName.trim() && !this.selectedCategoryId) {
      const name = this.selectedCategoryName.trim();
      this.confirmService
        .confirm({
          title: 'Create category',
          message: `Selected category "${name}" doesn't exist. Do you want to create it?`,
          confirmLabel: 'Create',
        })
        .subscribe((ok) => {
          if (!ok) return;
          this.electron.createCategory(name).subscribe({
            next: (newId) => {
              this.selectedCategoryId = Number(newId);
              this.categories = [
                ...this.categories,
                { id: this.selectedCategoryId, name, envelopeId: null, isDefault: false },
              ];
              this.save();
            },
            error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
          });
        });
      return;
    }

    this.showErrors = true;
    if (!this.isValid) return;

    const quantityCents = this.amountCents!;
    const date = new Date(this.date + 'T00:00:00');
    const isPositive = this.type === 'income';
    // Non-split → a single-entry allocation; split → the editor's map (already summing to the total).
    const envelopeIdMap = this.splitMode
      ? this.splitMap
      : new Map([[this.selectedEnvelopeId!, quantityCents]]);
    const categoryId = this.selectedCategoryId!;

    if (this.isEditing) {
      const movement: MovementT = {
        id: this.editingMovement!.id,
        accountId: this.editingMovement!.accountId,
        name: this.name,
        concept: this.concept || null,
        quantityCents,
        isPositive,
        date,
        categoryId,
        envelopeIdMap,
        additionalNotes: this.additionalNotes || null,
        // User-owned: sent from the form (the backend persists it on update).
        isAnomalous: this.isAnomalous,
        // System-owned: preserved as-is (the backend ignores them on update).
        templateId: this.editingMovement!.templateId,
        isTentative: this.editingMovement!.isTentative,
        parentId: this.editingMovement!.parentId,
      };
      this.electron
        .updateMovement(movement)
        .pipe(
          switchMap(() => {
            const toAdd = this.selectedTagIds.filter((id) => !this.currentTagIds.includes(id));
            const toRemove = this.currentTagIds.filter((id) => !this.selectedTagIds.includes(id));
            const ops = [
              ...toAdd.map((tagId) => this.electron.addTagToMovement(tagId, movement.id)),
              ...toRemove.map((tagId) => this.electron.removeTagFromMovement(tagId, movement.id)),
            ];
            return ops.length ? forkJoin(ops) : of(null);
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: () => this.afterSaved(),
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    } else {
      this.electron
        .createMovement(
          this.name,
          this.concept || null,
          quantityCents,
          isPositive,
          date,
          categoryId,
          envelopeIdMap,
          this.additionalNotes || null,
          this.isAnomalous,
        )
        .pipe(
          switchMap((newId) => {
            const ops = this.selectedTagIds.map((tagId) =>
              this.electron.addTagToMovement(tagId, Number(newId)),
            );
            return ops.length ? forkJoin(ops) : of(null);
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: () => {
            this.afterSaved();
            this.reset();
          },
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    }
  }

  onGearClick() {
    this.dialog.open(SettingsComponent).afterClosed().pipe(take(1)).subscribe(() => {
      this.electron
        .getSettings()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (s) => {
            this.useDefaultDate = s.useDefaultDate ?? false;
            this.loadedDefaultDate = s.defaultDate ?? '';
            if (!this.isEditing) {
              this.date =
                this.useDefaultDate && this.loadedDefaultDate
                  ? this.loadedDefaultDate
                  : this.todayString();
            }
          },
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    });
  }

  cancel() {
    this.cancelled.emit();
    this.dialogRef?.close();
  }

  /** Internal: called after a successful save. Closes the dialog if open. */
  private afterSaved() {
    this.saved.emit();
    this.dialogRef?.close();
  }

  todayString(): string {
    return this.dateToInput(new Date());
  }

  /** Local-timezone YYYY-MM-DD (matches the repository's stored format). */
  private dateToInput(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private reset() {
    this.name = '';
    this.concept = null;
    this.amountCents = null;
    this.type = 'income';
    this.selectedCategoryName = '';
    this.selectedCategoryId = null;
    this.selectedEnvelopeId = null;
    this.splitMode = false;
    this.splitMap = new Map();
    this.splitValid = false;
    this.initialSplit = null;
    this.selectedTagIds = [];
    this.currentTagIds = [];
    this.additionalNotes = null;
    this.isAnomalous = false;
    this.date = this.useDefaultDate && this.loadedDefaultDate ? this.loadedDefaultDate : this.todayString();
    this.showErrors = false;
  }
}
