import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PeriodSummaryCardComponent } from '../../shared/components/period-summary-card/period-summary-card.component';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import type { PeriodSummaryT } from '@shared/types';

type MonthKey = { year: number; month: number };

@Component({
  selector: 'app-month-overview',
  imports: [FormsModule, PeriodSummaryCardComponent],
  templateUrl: './month-overview.component.html',
  styleUrl: './month-overview.component.scss',
})
export class MonthOverviewComponent implements OnInit {
  private electron = inject(ElectronService);
  private errors = inject(ErrorReporter);
  private destroyRef = inject(DestroyRef);

  /** Envelope-level summaries only — account-level ones (envelopeId null) aren't maintained today. */
  private summaries: PeriodSummaryT[] = [];
  /** Index into `months` of the month currently shown (0 = most recent). */
  protected monthIndex = 0;
  /** When true, aggregates include anomalous movements; default excludes them (the whole point). */
  protected showAnomalies = false;

  ngOnInit(): void {
    this.electron
      .getAllPeriodSummaries()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((summaries) => {
        this.summaries = summaries.filter((s) => s.envelopeId !== null);
        this.monthIndex = 0;
      });
  }

  /** Distinct months present in the data, most recent first. */
  get months(): MonthKey[] {
    const seen = new Map<string, MonthKey>();
    for (const s of this.summaries) {
      seen.set(`${s.year}-${s.month}`, { year: s.year, month: s.month });
    }
    return [...seen.values()].sort((a, b) => b.year - a.year || b.month - a.month);
  }

  get current(): MonthKey | null {
    return this.months[this.monthIndex] ?? null;
  }

  get envelopeSummaries(): PeriodSummaryT[] {
    const cur = this.current;
    if (!cur) return [];
    return this.summaries.filter((s) => s.year === cur.year && s.month === cur.month);
  }

  get monthLabel(): string {
    const cur = this.current;
    if (!cur) return 'No data';
    return new Date(cur.year, cur.month, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  /** Months are sorted newest-first, so the older month sits at a higher index. */
  protected get hasPrev(): boolean {
    return this.monthIndex < this.months.length - 1;
  }

  protected get hasNext(): boolean {
    return this.monthIndex > 0;
  }

  protected prevMonth(): void {
    if (this.hasPrev) this.monthIndex++;
  }

  protected nextMonth(): void {
    if (this.hasNext) this.monthIndex--;
  }
}
