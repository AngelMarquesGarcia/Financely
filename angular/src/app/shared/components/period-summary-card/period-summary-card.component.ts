import { Component, Input, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { MoneyPipe } from '../../pipes/money.pipe';
import type { PeriodSummaryT } from '@shared/types';

@Component({
  selector: 'app-period-summary-card',
  imports: [FaIconComponent, MoneyPipe],
  templateUrl: './period-summary-card.component.html',
  styleUrl: './period-summary-card.component.scss',
})
export class PeriodSummaryCardComponent {
  @Input({ required: true }) summary!: PeriodSummaryT;

  protected expanded = signal(false);
  protected readonly faChevronRight = faChevronRight;
  protected readonly faChevronDown = faChevronDown;

  protected toggle(): void {
    this.expanded.update((v) => !v);
  }

  protected get label(): string {
    return this.summary.envelopeName ?? this.summary.accountName;
  }

  /** Remaining allowance for the month: budget − expenses. null when no budget is set. */
  protected get availableBudgetCents(): number | null {
    const budget = this.summary.budgetCents;
    if (budget == null) return null;
    return budget - this.summary.totalExpenseCents;
  }

  /** True when actual income to the envelope fell short of the budgeted allowance. */
  protected get underfunded(): boolean {
    const budget = this.summary.budgetCents;
    return budget != null && this.summary.totalIncomeCents < budget;
  }

  /**
   * Redirectable surplus: max(0, balance − (cap + budget)). null when uncapped. The `+ budget`
   * keeps the month's allowance available; this matches the backend redirect threshold, so the
   * figure reads 0 once an over-cap redirect has fired (the excess was transferred out).
   */
  protected get savingsOverflowCents(): number | null {
    const cap = this.summary.maxSavingsCents;
    if (cap === undefined) return null;
    const threshold = cap + (this.summary.budgetCents ?? 0);
    return Math.max(0, this.summary.endingBalanceCents - threshold);
  }
}
