import { BasicSummary, MovementT, PeriodSummaryT } from '@shared/types';
import { Movement, Period, PeriodSummary } from '@shared/domain';
import { periodSummaryRepository } from '../repository/period-summary-repository.service';
import { transferRepository } from '../repository/transfer-repository.service';
import { movementRepository } from '../repository/movement-repository.service';
import { movementService } from './movement.service';
import { accountService } from './account.service';
import { envelopeService } from './envelope.service';
import { AppError, AppErrorCode } from '@shared/error-codes';

export class PeriodSummaryService {
  create(period: Period): number | bigint {
    if (this.checkExists(period)) throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
    const summary = this.calculatePeriodSummary(period);
    return periodSummaryRepository.insert(summary);
  }

  checkExists(period: Period): boolean {
    return periodSummaryRepository.getByPeriod(period) != undefined;
  }

  getAll(): PeriodSummaryT[] {
    return periodSummaryRepository.getAll();
  }

  getByPeriod(period: Period): PeriodSummaryT {
    const periodSummary = periodSummaryRepository.getByPeriod(period);
    if (periodSummary == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
    if (periodSummary.dirtyState != 'CLEAN') {
      const result = this.cleanPeriodSummary(Period.fromPeriodSummary(periodSummary));
      if (result == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
      return result;
    }
    return periodSummary;
  }

  /**
   * The envelope's most recent summary, cleaned. Returns undefined when the envelope has no
   * summary yet (no movements/transfers), so callers can fall back to the starting balance.
   */
  getLatestPeriodSummary(envelopeId: number): PeriodSummaryT | undefined {
    const latest = periodSummaryRepository.getLatest(envelopeId);
    if (latest == undefined) return undefined;
    try {
      return this.getByPeriod(Period.fromPeriodSummary(latest));
    } catch {
      return undefined;
    }
  }

  recalculateFromMovement(updatedMovementId: number): void {
    const mov = movementService.getById(updatedMovementId);
    if (mov == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
    // A split movement lands in several envelope periods — recalc each.
    for (const period of Movement.from(mov).getPeriods()) this.recalculateForPeriod(period);
  }

  recalculateForPeriod(period: Period): number | bigint {
    try {
      const summary = this.calculatePeriodSummary(period);
      try {
        const existing = periodSummaryRepository.getByPeriod(period);
        if (existing == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
        return periodSummaryRepository.update(summary) ? 1 : -1;
      } catch {
        return this.create(period);
      }
    } catch {
      return periodSummaryRepository.delete(period) ? 1 : -1;
    }
  }

  delete(period: Period): boolean {
    return periodSummaryRepository.delete(period);
  }

  /** Upserts based on (accountId, envelopeId, year, month). */
  upsert(summary: PeriodSummaryT): number | bigint {
    if (this.checkExists(Period.from(summary))) {
      periodSummaryRepository.update(summary);
      return 1;
    }
    return periodSummaryRepository.insert(summary);
  }

  update(summary: PeriodSummary): boolean {
    return periodSummaryRepository.update(summary);
  }

  editNotes(period: Period, notes: string): void {
    const periodSum = periodSummaryRepository.getByPeriod(period);
    if (periodSum == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
    periodSum.notes = notes;
    periodSummaryRepository.update(periodSum);
  }

  markDirty(period: Period): void {
    const periodSum = periodSummaryRepository.getByPeriod(period);
    if (periodSum == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
    periodSum.dirtyState = 'MODIFIED';
    periodSummaryRepository.update(periodSum);
    // Every later month's ending balance depends on this one — mark them all DIRTY (gap-safe).
    periodSummaryRepository.markLaterDirty(period);
  }

  /** A movement or transfer landed in this period: create its summary if absent, else mark dirty. */
  periodTouched(period: Period) {
    const summary = periodSummaryRepository.getByPeriod(period);
    if (summary == undefined) {
      this.create(period);
      // A newly-created (possibly past) period shifts every later month's balance — re-chain them.
      periodSummaryRepository.markLaterDirty(period);
    } else {
      this.markDirty(period);
    }
  }

  /**
   * Recomputes only the `tentative` display flag for a period from its movements, leaving every
   * aggregate and `dirtyState` untouched. Used by confirm — which changes no amounts, so a full
   * recalc/markDirty would be wasteful. No-op when the period has no summary.
   */
  recomputeTentativeState(period: Period): void {
    const summary = periodSummaryRepository.getByPeriod(period);
    if (summary == undefined) return;
    const tentative = movementRepository.hasTentativeInPeriod(period);
    if (summary.tentative === tentative) return;
    summary.tentative = tentative;
    periodSummaryRepository.update(summary);
  }

  private cleanPeriodSummary(period: Period): PeriodSummaryT | undefined {
    const periodSummary = periodSummaryRepository.getByPeriod(period);
    if (periodSummary == undefined || periodSummary.dirtyState == 'CLEAN') return periodSummary;
    return this.cleanPeriodSummaryB(periodSummary, period);
  }

  private cleanPeriodSummaryB(
    periodSummary: PeriodSummaryT,
    period: Period,
  ): PeriodSummaryT | undefined {
    if (periodSummary.dirtyState == 'CLEAN') return periodSummary;

    if (periodSummary.dirtyState == 'MODIFIED') {
      // Aggregates changed: recompute everything from movements (anchor handled internally).
      try {
        const updatedSum = this.calculatePeriodSummary(period);
        periodSummaryRepository.update(updatedSum);
        return updatedSum;
      } catch {
        periodSummaryRepository.delete(period);
        return undefined;
      }
    }

    // DIRTY: aggregates are still valid; only re-anchor the ending balance on the most recent prior
    // summary (cleaning it first), skipping any gap months. No prior → the envelope/account start.
    const prevRaw = periodSummaryRepository.getLatestBefore(period);
    const prevSum = prevRaw
      ? this.cleanPeriodSummary(Period.fromPeriodSummary(prevRaw))
      : undefined;
    const anchor =
      prevSum != undefined ? prevSum.endingBalanceCents : this.startingBalanceFor(period);
    periodSummary.endingBalanceCents =
      anchor + periodSummary.cashFlowCents + periodSummary.netTransfersCents;
    periodSummary.dirtyState = 'CLEAN';
    periodSummaryRepository.update(periodSummary);
    return periodSummary;
  }

  private calculatePeriodSummary(period: Period): PeriodSummaryT {
    const movements = movementService.getByPeriod(period);

    // Internal transfers apply only to envelope-level summaries.
    let inCents = 0;
    let outCents = 0;
    if (period.envelopeId != null) {
      ({ inCents, outCents } = transferRepository.netForEnvelopePeriod(
        period.envelopeId,
        period.year,
        period.month,
      ));
    }
    const hasTransfers = inCents + outCents > 0;

    // A summary exists only if the period has at least one movement or transfer.
    if (movements.length === 0 && !hasTransfers) {
      throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
    }

    const result = this.buildSummary(period, movements);
    result.netTransfersCents = inCents - outCents;

    // Budget + savings-cap snapshots: freeze an existing summary's snapshot on recalc; otherwise
    // stamp the envelope's current values at first creation. Account-level summaries have neither.
    if (period.envelopeId != null) {
      const existing = periodSummaryRepository.getByPeriod(period);
      if (existing) {
        result.budgetCents = existing.budgetCents;
        result.maxSavingsCents = existing.maxSavingsCents;
      } else {
        const envelope = envelopeService.getById(period.envelopeId);
        result.budgetCents = envelope?.budgetCents ?? undefined;
        result.maxSavingsCents = envelope?.maxSavingsCents ?? undefined;
      }
    }

    // Anchor on the most recent prior summary, skipping months with no activity (gaps), so an
    // isolated earlier month's balance still carries forward.
    const prevPeriodSummary = periodSummaryRepository.getLatestBefore(period);
    const anchor =
      prevPeriodSummary != undefined
        ? prevPeriodSummary.endingBalanceCents
        : this.startingBalanceFor(period);
    result.endingBalanceCents = anchor + result.cashFlowCents + result.netTransfersCents;
    return result;
  }

  /** Starting balance to anchor the first period of a chain: the envelope's (or account's). */
  private startingBalanceFor(period: Period): number {
    if (period.envelopeId != undefined) {
      const envelope = envelopeService.getById(period.envelopeId);
      if (envelope == undefined) throw new AppError(AppErrorCode.ENVELOPE_NOT_FOUND);
      return envelope.startingBalance;
    }
    const account = accountService.getById(period.accountId);
    if (account == undefined) throw new AppError(AppErrorCode.ACCOUNT_NOT_FOUND);
    return account.startingBalance;
  }

  /**
   * Builds a summary skeleton from the period identity and its movements. Movements may be empty
   * (a period can exist solely because of transfers); aggregates are then all zero. The caller
   * stamps netTransfers, the budget/savings snapshots, and the ending balance.
   */
  private buildSummary(period: Period, movements: MovementT[]): PeriodSummaryT {
    const account = accountService.getById(period.accountId);
    if (account == undefined) throw new AppError(AppErrorCode.ACCOUNT_NOT_FOUND);

    let envelopeName: string | null = null;
    if (period.envelopeId != null) {
      const envelope = envelopeService.getById(period.envelopeId);
      if (envelope == undefined) throw new AppError(AppErrorCode.ENVELOPE_NOT_FOUND);
      envelopeName = envelope.name;
    }

    movements.forEach((m) => {
      if (m.accountId != period.accountId) throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
    });

    const sum = this.getBasicSummary(movements, period.envelopeId);

    return {
      accountId: period.accountId,
      envelopeId: period.envelopeId,
      accountName: account.name,
      envelopeName,
      year: period.year,
      month: period.month,
      cashFlowCents: sum.cashFlowCents,
      totalIncomeCents: sum.totalIncomeCents,
      totalExpenseCents: sum.totalExpenseCents,
      avgExpenseCents: sum.avgExpenseCents,
      avgIncomeCents: sum.avgIncomeCents,
      avgMovementAmountCents: sum.avgMovementAmountCents,
      movementCount: sum.movementCount,
      endingBalanceCents: 0, // set by calculatePeriodSummary
      netTransfersCents: 0, // set by calculatePeriodSummary
      budgetCents: undefined, // stamped by calculatePeriodSummary (freeze existing vs. envelope)
      maxSavingsCents: undefined, // stamped by calculatePeriodSummary (freeze existing vs. envelope)
      notes: undefined,
      dirtyState: 'CLEAN',
      tentative: movements.some((m) => m.isTentative),
    };
  }

  /**
   * A movement's contribution to a specific envelope. `getMovementsByPeriod` only returns movements
   * attributed to `envelopeId`, so the allocation is always present; a missing entry signals a
   * data-integrity bug rather than a legitimate case (a full-total fallback would over-count a split).
   */
  private amountForEnvelope(m: MovementT, envelopeId: number | null): number {
    if (envelopeId == null) return m.quantityCents;
    const amount = m.envelopeIdMap.get(envelopeId);
    if (amount == undefined) throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
    return amount;
  }

  private getBasicSummary(movements: MovementT[], envelopeId: number | null): BasicSummary {
    let totalIncomeCents = 0;
    let incomeCount = 0;
    let totalExpenseCents = 0;
    let expenseCount = 0;
    for (const movement of movements) {
      const amount = this.amountForEnvelope(movement, envelopeId);
      if (movement.isPositive) {
        totalIncomeCents += amount;
        incomeCount++;
      } else {
        totalExpenseCents += amount;
        expenseCount++;
      }
    }
    const movementCount = movements.length;
    const cashFlowCents = totalIncomeCents - totalExpenseCents;
    const avgIncomeCents = incomeCount != 0 ? totalIncomeCents / incomeCount : 0;
    const avgExpenseCents = expenseCount != 0 ? totalExpenseCents / expenseCount : 0;
    const avgMovementAmountCents =
      movementCount != 0 ? (totalIncomeCents + totalExpenseCents) / movementCount : 0;

    return {
      movementCount,
      totalIncomeCents,
      totalExpenseCents,
      cashFlowCents,
      avgExpenseCents,
      avgIncomeCents,
      avgMovementAmountCents,
    };
  }
}

export const periodSummaryService = new PeriodSummaryService();
