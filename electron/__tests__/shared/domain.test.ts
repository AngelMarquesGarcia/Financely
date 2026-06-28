import { describe, it, expect } from '@jest/globals';
import { Period, PeriodSummary, Movement } from '@shared/domain';
import type { MovementT, PeriodSummaryT } from '@shared/types';

const sampleMovementT: MovementT = {
  id: 5,
  accountId: 1,
  name: 'Lunch',
  concept: null,
  quantityCents: 1200,
  isPositive: false,
  date: new Date(2026, 3, 15), // April (month index 3) 2026
  categoryId: 2,
  envelopeId: 4,
  additionalNotes: null,
};

const sampleSummaryT: PeriodSummaryT = {
  accountId: 3,
  envelopeId: 7,
  accountName: 'Main',
  envelopeName: 'Food',
  year: 2026,
  month: 4,
  cashFlowCents: -1500,
  totalIncomeCents: 0,
  totalExpenseCents: 1500,
  avgExpenseCents: 750,
  avgIncomeCents: 0,
  avgMovementAmountCents: 750,
  movementCount: 2,
  endingBalanceCents: -1500,
  netTransfersCents: 0,
  budgetCents: 5000,
  maxSavingsCents: 10000,
  notes: 'note',
  dirtyState: 'CLEAN',
};

describe('Period — navigation and factories', () => {
  // ── getPrevious ──────────────────────────────────────────────────────────
  it('getPrevious moves back one month within the same year', () => {
    expect(new Period(1, 2, 2026, 5).getPrevious()).toEqual(new Period(1, 2, 2026, 4));
  });

  it('getPrevious wraps to December of the previous year at month 0', () => {
    expect(new Period(1, 2, 2026, 0).getPrevious()).toEqual(new Period(1, 2, 2025, 11));
  });

  it('getPrevious preserves accountId and a null envelopeId', () => {
    const p = new Period(7, null, 2026, 0).getPrevious();
    expect(p.accountId).toBe(7);
    expect(p.envelopeId).toBeNull();
    expect(p.year).toBe(2025);
    expect(p.month).toBe(11);
  });

  // ── getNext ──────────────────────────────────────────────────────────────
  it('getNext moves forward one month within the same year', () => {
    expect(new Period(1, 2, 2026, 5).getNext()).toEqual(new Period(1, 2, 2026, 6));
  });

  it('getNext wraps to January of the next year at month 11', () => {
    expect(new Period(1, 2, 2026, 11).getNext()).toEqual(new Period(1, 2, 2027, 0));
  });

  // ── factories ──────────────────────────────────────────────────────────────
  it('from maps the four key fields', () => {
    expect(Period.from({ accountId: 3, envelopeId: 9, year: 2024, month: 1 })).toEqual(
      new Period(3, 9, 2024, 1),
    );
  });

  it('fromMovement derives 0-indexed year/month from the date', () => {
    expect(Period.fromMovement(sampleMovementT)).toEqual(new Period(1, 4, 2026, 3));
  });

  it('fromPeriodSummary maps account/envelope/year/month', () => {
    expect(Period.fromPeriodSummary(sampleSummaryT)).toEqual(new Period(3, 7, 2026, 4));
  });
});

describe('Movement', () => {
  it('getPeriod returns the movement period', () => {
    expect(Movement.from(sampleMovementT).getPeriod()).toEqual(new Period(1, 4, 2026, 3));
  });

  it('from round-trips every field', () => {
    expect(Movement.from(sampleMovementT)).toEqual(sampleMovementT);
  });
});

describe('PeriodSummary', () => {
  it('getPeriod returns the matching period', () => {
    expect(PeriodSummary.from(sampleSummaryT).getPeriod()).toEqual(new Period(3, 7, 2026, 4));
  });

  it('from round-trips every field', () => {
    expect(PeriodSummary.from(sampleSummaryT)).toEqual(sampleSummaryT);
  });
});
