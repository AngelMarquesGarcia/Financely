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
}
