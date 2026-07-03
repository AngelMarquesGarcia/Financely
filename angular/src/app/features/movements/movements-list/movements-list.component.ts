import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CategoryT, EnvelopeT, MovementT, MovementFilter, TagT } from '@shared/types';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { contrastColor } from '../../../shared/utils';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { MovementsFilterComponent } from '../movements-filter/movements-filter.component';
import { QuickCreateMovementButtonComponent } from '../../../shared/components/quick-create-movement-button/quick-create-movement-button.component';

type HeaderRow = { kind: 'header'; key: string; label: string };
type MovementRow = { kind: 'movement'; key: string; movement: MovementT };
type RowItem = HeaderRow | MovementRow;

@Component({
  selector: 'app-movements-list',
  imports: [MoneyPipe, EmptyStateComponent, MovementsFilterComponent, QuickCreateMovementButtonComponent],
  templateUrl: './movements-list.component.html',
  styleUrl: './movements-list.component.scss',
})
export class MovementsListComponent {
  @Input() movements: MovementT[] = [];
  @Input() categories: CategoryT[] = [];
  @Input() envelopes: EnvelopeT[] = [];
  @Input() tags: TagT[] = [];
  @Input() movementTags: Record<number, TagT[]> = {};
  /** When the list is scoped to one envelope, split movements show only that envelope's share. */
  @Input() scopedEnvelopeId: number | null = null;
  @Output() editRequested = new EventEmitter<MovementT>();
  @Output() deleteRequested = new EventEmitter<number>();
  @Output() confirmRequested = new EventEmitter<number>();
  @Output() bulkDeleteRequested = new EventEmitter<number[]>();
  @Output() filterChanged = new EventEmitter<MovementFilter>();

  contrastColor = contrastColor;

  /** ids of currently checked rows. */
  selected = new Set<number>();
  /** the filter component reports whether anything is active — used for the empty-state message. */
  filterActive = false;

  onFilterChanged(filter: MovementFilter) {
    this.filterActive =
      !!filter.date ||
      !!filter.amount ||
      !!filter.text ||
      !!filter.tags ||
      filter.categoryId != null ||
      filter.envelopeId != null ||
      filter.isPositive != null;
    this.filterChanged.emit(filter);
  }

  toggleRow(id: number, checked: boolean) {
    if (checked) this.selected.add(id);
    else this.selected.delete(id);
    // Force change detection by re-creating the set
    this.selected = new Set(this.selected);
  }

  isRowSelected(id: number): boolean {
    return this.selected.has(id);
  }

  toggleAll(checked: boolean) {
    if (checked) this.selected = new Set(this.movements.map((m) => m.id));
    else this.selected = new Set();
  }

  get allSelected(): boolean {
    return this.movements.length > 0 && this.selected.size === this.movements.length;
  }

  get someSelected(): boolean {
    return this.selected.size > 0 && !this.allSelected;
  }

  emitBulkDelete() {
    this.bulkDeleteRequested.emit([...this.selected]);
    this.selected = new Set();
  }

  getMovementTags(movementId: number): TagT[] {
    return this.movementTags[movementId] ?? [];
  }

  getCategory(categoryId: number): CategoryT | undefined {
    return this.categories.find((c) => c.id === categoryId);
  }

  getEnvelope(envelopeId: number): EnvelopeT | undefined {
    return this.envelopes.find((e) => e.id === envelopeId);
  }

  get groupedRows(): RowItem[] {
    const sorted = [...this.movements].sort((a, b) => {
      const aTime = (a.date instanceof Date ? a.date : new Date(String(a.date))).getTime();
      const bTime = (b.date instanceof Date ? b.date : new Date(String(b.date))).getTime();
      return bTime - aTime;
    });

    const rows: RowItem[] = [];
    let lastMonth = '';
    for (const m of sorted) {
      const d = m.date instanceof Date ? m.date : new Date(String(m.date));
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthKey !== lastMonth) {
        rows.push({
          kind: 'header',
          key: `h_${monthKey}`,
          label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        });
        lastMonth = monthKey;
      }
      rows.push({ kind: 'movement', key: `m_${m.id}`, movement: m });
    }
    return rows;
  }

  signedCents(m: MovementT): number {
    return m.isPositive ? m.quantityCents : -m.quantityCents;
  }

  /** A movement is split when it is divided across more than one envelope (CU3). */
  isSplit(m: MovementT): boolean {
    return m.envelopeIdMap.size > 1;
  }

  /** True when the row shows only part of a split (list scoped to one of its envelopes). */
  isPartial(m: MovementT): boolean {
    return this.scopedEnvelopeId != null && this.isSplit(m);
  }

  /**
   * Signed amount to display: when scoped to an envelope, a split shows that envelope's share;
   * otherwise the full total.
   */
  displayAmountCents(m: MovementT): number {
    const base =
      this.scopedEnvelopeId != null
        ? (m.envelopeIdMap.get(this.scopedEnvelopeId) ?? m.quantityCents)
        : m.quantityCents;
    return m.isPositive ? base : -base;
  }

  /** Envelope column label: the scoped envelope, the single envelope, or "Multiple" for a split. */
  envelopeLabel(m: MovementT): string {
    if (this.scopedEnvelopeId != null) return this.getEnvelope(this.scopedEnvelopeId)?.name ?? '—';
    const ids = [...m.envelopeIdMap.keys()];
    if (ids.length === 0) return '—';
    if (ids.length === 1) return this.getEnvelope(ids[0])?.name ?? '—';
    return 'Multiple';
  }

  formatDate(date: unknown): string {
    if (date instanceof Date) {
      const y = date.getFullYear();
      const mo = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${mo}-${d}`;
    }
    return String(date).substring(0, 10);
  }
}
