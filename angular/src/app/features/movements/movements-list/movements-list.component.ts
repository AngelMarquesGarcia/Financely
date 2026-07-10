import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  CategoryT,
  CompoundMovementT,
  EnvelopeT,
  MovementT,
  MovementFilter,
  TagT,
} from '@shared/types';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { contrastColor } from '../../../shared/utils';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { MovementsFilterComponent } from '../movements-filter/movements-filter.component';
import { QuickCreateMovementButtonComponent } from '../../../shared/components/quick-create-movement-button/quick-create-movement-button.component';

type HeaderRow = { kind: 'header'; key: string; label: string };
/** `inactive` = a compound child shown in a non-owner month (greyed, uncounted). `childOf` = shown
 *  inside an expanded owner-month compound group. */
type MovementRow = {
  kind: 'movement';
  key: string;
  movement: MovementT;
  inactive: boolean;
  childOf?: number;
};
/** The owner-month collapsed pseudo-entry for a compound (expands to that month's members, D15). */
type CompoundGroupRow = {
  kind: 'compound';
  key: string;
  compound: CompoundMovementT;
  monthChildren: MovementT[];
  expanded: boolean;
};
type RowItem = HeaderRow | MovementRow | CompoundGroupRow;

@Component({
  selector: 'app-movements-list',
  imports: [
    MoneyPipe,
    EmptyStateComponent,
    MovementsFilterComponent,
    QuickCreateMovementButtonComponent,
  ],
  templateUrl: './movements-list.component.html',
  styleUrl: './movements-list.component.scss',
})
export class MovementsListComponent {
  @Input() movements: MovementT[] = [];
  @Input() categories: CategoryT[] = [];
  @Input() envelopes: EnvelopeT[] = [];
  @Input() tags: TagT[] = [];
  @Input() movementTags: Record<number, TagT[]> = {};
  @Input() compounds: CompoundMovementT[] = [];
  /** When the list is scoped to one envelope, split movements show only that envelope's share. */
  @Input() scopedEnvelopeId: number | null = null;
  @Output() editRequested = new EventEmitter<MovementT>();
  @Output() deleteRequested = new EventEmitter<number>();
  @Output() confirmRequested = new EventEmitter<number>();
  @Output() bulkDeleteRequested = new EventEmitter<number[]>();
  @Output() filterChanged = new EventEmitter<MovementFilter>();
  @Output() compoundDetailRequested = new EventEmitter<CompoundMovementT>();

  contrastColor = contrastColor;

  /** ids of currently checked rows. */
  selected = new Set<number>();
  /** Compound ids whose owner-month group is expanded. */
  private expandedGroups = new Set<number>();
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
    const sorted = [...this.movements].sort(
      (a, b) => this.asDate(b.date).getTime() - this.asDate(a.date).getTime(),
    );

    const rows: RowItem[] = [];
    let lastMonth = '';
    let groupsThisMonth = new Set<number>();
    for (const m of sorted) {
      const d = this.asDate(m.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthKey !== lastMonth) {
        rows.push({
          kind: 'header',
          key: `h_${monthKey}`,
          label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        });
        lastMonth = monthKey;
        groupsThisMonth = new Set<number>();
      }

      const compound = this.compoundFor(m);
      if (compound && this.isOwnerMonth(compound, d)) {
        // Owner-month members collapse into one expandable pseudo-row per compound.
        if (!groupsThisMonth.has(compound.id)) {
          groupsThisMonth.add(compound.id);
          const monthChildren = sorted.filter(
            (x) => x.parentId === compound.id && this.sameMonth(this.asDate(x.date), d),
          );
          const expanded = this.expandedGroups.has(compound.id);
          rows.push({
            kind: 'compound',
            key: `c_${compound.id}_${monthKey}`,
            compound,
            monthChildren,
            expanded,
          });
          if (expanded) {
            for (const child of monthChildren) {
              rows.push({
                kind: 'movement',
                key: `m_${child.id}`,
                movement: child,
                inactive: false,
                childOf: compound.id,
              });
            }
          }
        }
      } else if (compound) {
        // A compound member outside its owner month (or a null-owner compound): shown but uncounted.
        rows.push({ kind: 'movement', key: `m_${m.id}`, movement: m, inactive: true });
      } else {
        rows.push({ kind: 'movement', key: `m_${m.id}`, movement: m, inactive: false });
      }
    }
    return rows;
  }

  compoundFor(m: MovementT): CompoundMovementT | undefined {
    return m.parentId == null ? undefined : this.compounds.find((c) => c.id === m.parentId);
  }

  private isOwnerMonth(compound: CompoundMovementT, d: Date): boolean {
    return compound.ownerYear === d.getFullYear() && compound.ownerMonth === d.getMonth();
  }

  private sameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  private asDate(date: unknown): Date {
    return date instanceof Date ? date : new Date(String(date));
  }

  toggleGroup(compoundId: number): void {
    if (this.expandedGroups.has(compoundId)) this.expandedGroups.delete(compoundId);
    else this.expandedGroups.add(compoundId);
    this.expandedGroups = new Set(this.expandedGroups);
  }

  /** "April 2026" or "Yearly" (a null-owner compound), for the group row / greyed-row tooltip. */
  ownerLabel(compound: CompoundMovementT): string {
    if (compound.ownerYear == null || compound.ownerMonth == null) return 'Yearly';
    return new Date(compound.ownerYear, compound.ownerMonth, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  /** Signed subtotal of an owner-month group's members (respects the scoped-envelope share). */
  groupSubtotalCents(children: MovementT[]): number {
    return children.reduce((sum, m) => sum + this.displayAmountCents(m), 0);
  }

  /** Tooltip on a greyed non-owner member row. */
  inactiveTitle(m: MovementT): string {
    const c = this.compoundFor(m);
    return c
      ? `Part of compound "${c.name}" — counted in ${this.ownerLabel(c)}, not this month`
      : '';
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
