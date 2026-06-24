import { Component } from '@angular/core';
import { PeriodSummaryCardComponent } from '../../shared/components/period-summary-card/period-summary-card.component';
import type { PeriodSummaryT } from '@shared/types';
import {
  SAMPLE_ACCOUNT_SUMMARY,
  SAMPLE_SUMMARIES,
} from '../../../testing/sample-summaries';

@Component({
  selector: 'app-month-overview',
  imports: [PeriodSummaryCardComponent],
  templateUrl: './month-overview.component.html',
  styleUrl: './month-overview.component.scss',
})
export class MonthOverviewComponent {
  protected readonly accountSummary = SAMPLE_ACCOUNT_SUMMARY;
  protected readonly envelopeSummaries: PeriodSummaryT[] = SAMPLE_SUMMARIES.filter(
    (s) => s.envelopeId !== null,
  );
  protected readonly monthLabel = 'June 2025';
}
