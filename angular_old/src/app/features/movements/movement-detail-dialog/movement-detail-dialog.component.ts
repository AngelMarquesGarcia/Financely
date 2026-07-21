import { Component, inject } from '@angular/core';
import { CategoryT, EnvelopeT, MovementT, TagT } from '@shared/types';
import { DIALOG_DATA } from '../../../core/services/dialog.tokens';
import { DialogRef } from '../../../core/services/dialog-ref';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

export type MovementDetailData = {
  movement: MovementT;
  categories: CategoryT[];
  envelopes: EnvelopeT[];
  tags: TagT[];
};

export type MovementDetailResult = { action: 'edit' | 'delete' };

@Component({
  selector: 'app-movement-detail-dialog',
  imports: [MoneyPipe],
  templateUrl: './movement-detail-dialog.component.html',
  styleUrl: './movement-detail-dialog.component.scss',
})
export class MovementDetailDialogComponent {
  protected readonly data = inject<MovementDetailData>(DIALOG_DATA);
  protected readonly dialogRef = inject(DialogRef<MovementDetailResult>);

  get movement(): MovementT {
    return this.data.movement;
  }

  get category(): CategoryT | undefined {
    return this.data.categories.find((c) => c.id === this.movement.categoryId);
  }

  /** True when the movement is divided across more than one envelope (CU3). */
  get isSplit(): boolean {
    return this.movement.envelopeIdMap.size > 1;
  }

  /** The sole envelope for a non-split movement (undefined for a split — the breakdown is shown). */
  get envelope(): EnvelopeT | undefined {
    if (this.isSplit) return undefined;
    const id = [...this.movement.envelopeIdMap.keys()][0];
    return this.data.envelopes.find((e) => e.id === id);
  }

  /** Per-envelope rows for a split movement's breakdown. */
  get splitRows(): { name: string; amountCents: number }[] {
    return [...this.movement.envelopeIdMap].map(([id, amountCents]) => ({
      name: this.data.envelopes.find((e) => e.id === id)?.name ?? '—',
      amountCents,
    }));
  }

  get tags(): TagT[] {
    return this.data.tags;
  }

  signedCents(): number {
    const m = this.movement;
    return m.isPositive ? m.quantityCents : -m.quantityCents;
  }

  contrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.58 ? '#0f172a' : '#ffffff';
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

  edit(): void {
    this.dialogRef.close({ action: 'edit' });
  }

  delete(): void {
    this.dialogRef.close({ action: 'delete' });
  }
}
