import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import {
  CategoryT,
  EnvelopeT,
  MovementFilter,
  TagT,
  TextMatchCondition,
  TextMatchField,
} from '@shared/types';
import { TagPickerComponent } from '../../../shared/components/tag-picker/tag-picker.component';
import { PopoverComponent } from '../../../shared/components/popover/popover.component';
import { AmountInputComponent } from '../../../shared/components/amount-input/amount-input.component';

@Component({
  selector: 'app-movements-filter',
  imports: [
    FormsModule,
    FaIconComponent,
    TagPickerComponent,
    PopoverComponent,
    AmountInputComponent,
  ],
  templateUrl: './movements-filter.component.html',
  styleUrl: './movements-filter.component.scss',
})
export class MovementsFilterComponent {
  protected readonly faFilter = faFilter;
  @Input() categories: CategoryT[] = [];
  @Input() envelopes: EnvelopeT[] = [];
  @Input() tags: TagT[] = [];
  @Output() filterChanged = new EventEmitter<MovementFilter>();

  showPanel = false;

  readonly textModes: { value: TextMatchCondition; label: string }[] = [
    { value: 'contains', label: 'Contains' },
    { value: 'startsWith', label: 'Starts with' },
    { value: 'endsWith', label: 'Ends with' },
    { value: 'exact', label: 'Exact match' },
  ];

  filterFrom = '';
  filterTo = '';
  filterMinCents: number | null = null;
  filterMaxCents: number | null = null;
  filterCategoryId: number | null = null;
  filterEnvelopeId: number | null = null;
  filterTagIds: number[] = [];
  filterTagMatchAll = false;
  filterText = '';
  filterTextIn: TextMatchField = 'all';
  filterTextMode: TextMatchCondition = 'contains';
  filterType: 'all' | 'income' | 'expense' = 'all';

  get hasActiveFilter(): boolean {
    return !!(
      this.filterFrom ||
      this.filterTo ||
      this.filterMinCents != null ||
      this.filterMaxCents != null ||
      this.filterCategoryId != null ||
      this.filterEnvelopeId != null ||
      this.filterTagIds.length ||
      this.filterText.trim() ||
      this.filterType !== 'all'
    );
  }

  emitChange() {
    this.filterChanged.emit({
      date:
        this.filterFrom || this.filterTo
          ? { from: this.filterFrom || undefined, to: this.filterTo || undefined }
          : undefined,
      amount:
        this.filterMinCents != null || this.filterMaxCents != null
          ? { from: this.filterMinCents ?? undefined, to: this.filterMaxCents ?? undefined }
          : undefined,
      text: this.filterText.trim()
        ? {
            query: this.filterText.trim(),
            condition: this.filterTextMode,
            field: this.filterTextIn,
          }
        : undefined,
      tags: this.filterTagIds.length
        ? { ids: this.filterTagIds, matchAll: this.filterTagMatchAll }
        : undefined,
      categoryId: this.filterCategoryId ?? undefined,
      envelopeId: this.filterEnvelopeId ?? undefined,
      isPositive: this.filterType === 'all' ? undefined : this.filterType === 'income',
    });
  }

  onMinChange(cents: number | null) {
    this.filterMinCents = cents;
    this.emitChange();
  }

  onMaxChange(cents: number | null) {
    this.filterMaxCents = cents;
    this.emitChange();
  }

  clearFilter() {
    this.filterFrom = '';
    this.filterTo = '';
    this.filterMinCents = null;
    this.filterMaxCents = null;
    this.filterCategoryId = null;
    this.filterEnvelopeId = null;
    this.filterTagIds = [];
    this.filterTagMatchAll = false;
    this.filterText = '';
    this.filterTextIn = 'all';
    this.filterTextMode = 'contains';
    this.filterType = 'all';
    this.emitChange();
  }
}
