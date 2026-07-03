import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EnvelopeT } from '@shared/types';
import { AmountInputComponent } from '../amount-input/amount-input.component';
import { MoneyPipe } from '../../pipes/money.pipe';

type Row = { key: number; envelopeId: number | null; amountCents: number | null };

/**
 * Edits a movement's per-envelope split. Rows of (envelope, amount); emits the assembled
 * `{ envelopeId → amountCents }` map and a validity flag. Valid when every row is complete, no
 * envelope repeats, and the shares sum exactly to `totalCents`.
 */
@Component({
  selector: 'app-envelope-split-editor',
  imports: [FormsModule, AmountInputComponent, MoneyPipe],
  templateUrl: './envelope-split-editor.component.html',
  styleUrl: './envelope-split-editor.component.scss',
})
export class EnvelopeSplitEditorComponent implements OnInit, OnChanges {
  @Input() envelopes: EnvelopeT[] = [];
  /** The movement total the shares must sum to. */
  @Input() totalCents: number | null = null;
  /** Existing allocation to seed the rows from (edit flow). */
  @Input() initial: Map<number, number> | null = null;
  @Output() valueChange = new EventEmitter<Map<number, number>>();
  @Output() validChange = new EventEmitter<boolean>();

  rows: Row[] = [];
  private nextKey = 0;

  ngOnInit(): void {
    if (this.initial && this.initial.size > 0) {
      this.rows = [...this.initial].map(([envelopeId, amountCents]) => ({
        key: this.nextKey++,
        envelopeId,
        amountCents,
      }));
    } else {
      this.rows = [this.blankRow(), this.blankRow()];
    }
    this.emit();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // The movement total can change after the rows are filled (e.g. the user sets/tweaks the Amount
    // field last), which shifts `remainingCents` and thus validity. Re-emit so the parent's cached
    // flag stays in sync. Skip the first change — ngOnInit seeds the rows and emits the initial state.
    if (changes['totalCents'] && !changes['totalCents'].firstChange) this.emit();
  }

  private blankRow(): Row {
    return { key: this.nextKey++, envelopeId: null, amountCents: null };
  }

  addRow(): void {
    this.rows = [...this.rows, this.blankRow()];
    this.emit();
  }

  removeRow(key: number): void {
    this.rows = this.rows.filter((r) => r.key !== key);
    this.emit();
  }

  onChange(): void {
    this.emit();
  }

  get assignedCents(): number {
    return this.rows.reduce((sum, r) => sum + (r.amountCents ?? 0), 0);
  }

  get remainingCents(): number {
    return (this.totalCents ?? 0) - this.assignedCents;
  }

  private get hasDuplicate(): boolean {
    const ids = this.rows.map((r) => r.envelopeId).filter((id): id is number => id != null);
    return new Set(ids).size !== ids.length;
  }

  get isValid(): boolean {
    return (
      this.totalCents != null &&
      this.rows.length >= 1 &&
      this.rows.every((r) => r.envelopeId != null && r.amountCents != null && r.amountCents > 0) &&
      !this.hasDuplicate &&
      this.remainingCents === 0
    );
  }

  private emit(): void {
    const map = new Map<number, number>();
    for (const r of this.rows) {
      if (r.envelopeId != null && r.amountCents != null && r.amountCents > 0) {
        map.set(r.envelopeId, r.amountCents);
      }
    }
    this.valueChange.emit(map);
    this.validChange.emit(this.isValid);
  }
}
