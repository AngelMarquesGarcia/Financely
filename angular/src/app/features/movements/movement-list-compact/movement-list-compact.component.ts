import { Component, DestroyRef, EventEmitter, inject, Input, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CategoryT, EnvelopeT, MovementT, TagT } from '@shared/types';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { DialogService } from '../../../core/services/dialog.service';
import {
  MovementDetailDialogComponent,
  MovementDetailResult,
} from '../movement-detail-dialog/movement-detail-dialog.component';

type HeaderRow = { kind: 'header'; key: string; label: string };
type MovementRow = { kind: 'movement'; key: string; movement: MovementT };
type RowItem = HeaderRow | MovementRow;

@Component({
  selector: 'app-movement-list-compact',
  imports: [MoneyPipe, EmptyStateComponent],
  templateUrl: './movement-list-compact.component.html',
  styleUrl: './movement-list-compact.component.scss',
})
export class MovementListCompactComponent {
  private readonly dialog = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() movements: MovementT[] = [];
  @Input() categories: CategoryT[] = [];
  @Input() envelopes: EnvelopeT[] = [];
  @Input() movementTags: Record<number, TagT[]> = {};
  @Output() editRequested = new EventEmitter<MovementT>();
  @Output() deleteRequested = new EventEmitter<number>();

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

  openDetail(m: MovementT): void {
    const ref = this.dialog.open<MovementDetailDialogComponent, unknown, MovementDetailResult>(
      MovementDetailDialogComponent,
      {
        data: {
          movement: m,
          categories: this.categories,
          envelopes: this.envelopes,
          tags: this.movementTags[m.id] ?? [],
        },
      },
    );

    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result?.action === 'edit') this.editRequested.emit(m);
        if (result?.action === 'delete') this.deleteRequested.emit(m.id);
      });
  }

  signedCents(m: MovementT): number {
    return m.isPositive ? m.quantityCents : -m.quantityCents;
  }
}
