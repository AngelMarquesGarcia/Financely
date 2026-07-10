import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EnvelopeT, TransferT } from '@shared/types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

@Component({
  selector: 'app-transfers-list',
  imports: [EmptyStateComponent, MoneyPipe],
  templateUrl: './transfers-list.component.html',
  styleUrl: './transfers-list.component.scss',
})
export class TransfersListComponent {
  @Input() transfers: TransferT[] = [];
  @Input() envelopes: EnvelopeT[] = [];
  @Output() deleteRequested = new EventEmitter<number>();

  envelopeName(id: number): string {
    return this.envelopes.find((e) => e.id === id)?.name ?? '—';
  }

  /** Auto transfers carry no user notes; describe why they were created instead. */
  notesFor(t: TransferT): string {
    if (t.isAuto) return 'Automatic transfer due to overflow in emitter envelope';
    return t.notes ?? '—';
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
