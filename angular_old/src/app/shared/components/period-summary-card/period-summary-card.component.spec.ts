import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PeriodSummaryCardComponent } from './period-summary-card.component';
import { BasicSummary, PeriodSummaryT } from '@shared/types';

function basic(over: Partial<BasicSummary> = {}): BasicSummary {
  return {
    cashFlowCents: 0,
    totalIncomeCents: 0,
    totalExpenseCents: 0,
    avgExpenseCents: 0,
    avgIncomeCents: 0,
    avgMovementAmountCents: 0,
    movementCount: 0,
    ...over,
  };
}

function makeSummary(over: Partial<PeriodSummaryT> = {}): PeriodSummaryT {
  return {
    accountId: 1,
    envelopeId: 1,
    accountName: 'Main',
    envelopeName: 'Food',
    year: 2026,
    month: 3,
    cashFlowCents: -12000,
    totalIncomeCents: 0,
    totalExpenseCents: 12000,
    avgExpenseCents: 12000,
    avgIncomeCents: 0,
    avgMovementAmountCents: 12000,
    movementCount: 1,
    endingBalanceCents: -12000,
    netTransfersCents: 0,
    budgetCents: undefined,
    maxSavingsCents: undefined,
    notes: undefined,
    dirtyState: 'CLEAN',
    tentative: false,
    summaryWithoutAnomalies: null,
    summaryCompoundAdjusted: null,
    summaryCompoundAdjustedWithoutAnomalies: null,
    ...over,
  };
}

describe('PeriodSummaryCardComponent', () => {
  // effective/hasCompound are protected (template-only); read them through `any` in tests.
  function make(summary: PeriodSummaryT, showAnomalies = false) {
    const fixture = TestBed.configureTestingModule({
      imports: [PeriodSummaryCardComponent],
    }).createComponent(PeriodSummaryCardComponent);
    fixture.componentInstance.summary = summary;
    fixture.componentInstance.showAnomalies = showAnomalies;
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      effective: BasicSummary;
      hasCompound: boolean;
    };
  }

  it('uses the top-level figures when no mirror exists', () => {
    const comp = make(makeSummary());
    expect(comp.effective.cashFlowCents).toBe(-12000);
    expect(comp.hasCompound).toBe(false);
  });

  it('prefers the compound-adjusted mirror (with anomalies shown)', () => {
    const comp = make(
      makeSummary({ summaryCompoundAdjusted: basic({ cashFlowCents: -2000, movementCount: 1 }) }),
      true,
    );
    expect(comp.effective.cashFlowCents).toBe(-2000);
    expect(comp.hasCompound).toBe(true);
  });

  it('prefers the compound-adjusted-without-anomalies mirror when anomalies are hidden', () => {
    const comp = make(
      makeSummary({
        summaryWithoutAnomalies: basic({ cashFlowCents: 0 }),
        summaryCompoundAdjusted: basic({ cashFlowCents: -2000 }),
        summaryCompoundAdjustedWithoutAnomalies: basic({ cashFlowCents: -1000 }),
      }),
      false,
    );
    expect(comp.effective.cashFlowCents).toBe(-1000);
  });

  it('falls back to the plain without-anomalies mirror when no compound-without exists', () => {
    const comp = make(
      makeSummary({ summaryWithoutAnomalies: basic({ cashFlowCents: -5000 }) }),
      false,
    );
    expect(comp.effective.cashFlowCents).toBe(-5000);
  });
});
