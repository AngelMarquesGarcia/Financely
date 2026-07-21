import { Component, Input, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { MoneyPipe } from '../../pipes/money.pipe';
import type { BasicSummary, FilterSummaryEntry, FilterSummaryT } from '@shared/types';

/**
 * Displays an on-the-fly FilterSummary (the aggregate over the filtered interval, plus a per-month
 * breakdown). Mirrors PeriodSummaryCardComponent's anomaly-toggle behaviour but carries no
 * balance/budget fields — a filter slice is not a money pool.
 */
@Component({
  selector: 'app-filter-summary',
  imports: [FaIconComponent, MoneyPipe],
  templateUrl: './filter-summary.component.html',
  styleUrl: './filter-summary.component.scss',
})
export class FilterSummaryComponent {
  @Input({ required: true }) summary!: FilterSummaryT;
  /** When false (default), figures exclude anomalous movements. */
  @Input() showAnomalies = false;

  protected expanded = signal(false);
  protected readonly faChevronRight = faChevronRight;
  protected readonly faChevronDown = faChevronDown;

  protected toggle(): void {
    this.expanded.update((v) => !v);
  }

  /** The entry's effective figures per the anomaly toggle; falls back when the slice has no anomalies. */
  protected effective(entry: FilterSummaryEntry): BasicSummary {
    return this.showAnomalies ? entry.summary : (entry.summaryWithoutAnomalies ?? entry.summary);
  }

  protected hasAnomalies(entry: FilterSummaryEntry): boolean {
    return entry.summaryWithoutAnomalies !== null;
  }

  /** Month label for a child entry, from its stamped filter date (YYYY-MM-01). */
  protected monthLabel(entry: FilterSummaryEntry): string {
    const from = entry.summary.filters?.date?.from;
    if (!from) return '';
    const [y, m] = from.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }
}
