import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AccountT, EnvelopeT, PeriodSummaryT } from '@shared/types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

@Component({
  selector: 'app-envelopes-list',
  imports: [EmptyStateComponent, MoneyPipe],
  templateUrl: './envelopes-list.component.html',
  styleUrl: './envelopes-list.component.scss',
})
export class EnvelopesListComponent {
  @Input() envelopes: EnvelopeT[] = [];
  @Input() accounts: AccountT[] = [];
  /** Latest period summary per envelope id; absent when the envelope has no activity yet. */
  @Input() summaries: Record<number, PeriodSummaryT> = {};
  @Output() editRequested = new EventEmitter<EnvelopeT>();
  @Output() deleteRequested = new EventEmitter<number>();
  @Output() setDefaultRequested = new EventEmitter<number>();

  accountName(accountId: number | null): string {
    if (accountId === null) return '—';
    return this.accounts.find((a) => a.id === accountId)?.name ?? '—';
  }

  /** Running balance from the latest summary; falls back to the starting balance when none exists. */
  balanceCents(envelope: EnvelopeT): number {
    return this.summaries[envelope.id]?.endingBalanceCents ?? envelope.startingBalance;
  }

  /** Remaining allowance for the latest summary's month (budget − expenses); null when no budget. */
  availableBudgetCents(envelope: EnvelopeT): number | null {
    const summary = this.summaries[envelope.id];
    if (summary?.budgetCents == null) return null;
    return summary.budgetCents - summary.totalExpenseCents;
  }
}
