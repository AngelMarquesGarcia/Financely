import { BasicSummary, MovementT, PeriodSummaryT } from '@shared/types';
import { Period, PeriodSummary } from '@shared/domain';
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

  recalculateFromMovement(updatedMovementId: number): number | bigint {
    const mov = movementService.getById(updatedMovementId);
    if (mov == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
    return this.recalculateForPeriod(Period.fromMovement(mov));
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

    let nextPeriod = period.getNext();
    let nextSum = periodSummaryRepository.getByPeriod(nextPeriod);
    while (nextSum != undefined) {
      nextSum.dirtyState = 'DIRTY';
      periodSummaryRepository.update(nextSum);
      nextPeriod = nextPeriod.getNext();
      nextSum = periodSummaryRepository.getByPeriod(nextPeriod);
    }
  }

  /** A movement or transfer landed in this period: create its summary if absent, else mark dirty. */
  periodTouched(period: Period) {
    const summary = periodSummaryRepository.getByPeriod(period);
    if (summary == undefined) this.create(period);
    else this.markDirty(period);
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

    const prevSum = this.cleanPeriodSummary(period.getPrevious());
    if (periodSummary.dirtyState == 'MODIFIED') {
      try {
        const updatedSum = this.calculatePeriodSummary(period);
        periodSummaryRepository.update(updatedSum);
        return updatedSum;
      } catch {
        periodSummaryRepository.delete(period);
        return undefined;
      }
    }
    if (prevSum == undefined) {
      throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
    }
    periodSummary.endingBalanceCents =
      prevSum.endingBalanceCents + periodSummary.cashFlowCents + periodSummary.netTransfersCents;
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

    const prevPeriodSummary = periodSummaryRepository.getByPeriod(period.getPrevious());
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
      if (m.accountId != period.accountId || m.envelopeId != period.envelopeId)
        throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
    });

    const sum = this.getBasicSummary(movements);

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

  private getBasicSummary(movements: MovementT[]): BasicSummary {
    let totalIncomeCents = 0;
    let incomeCount = 0;
    let totalExpenseCents = 0;
    let expenseCount = 0;
    for (const movement of movements) {
      if (movement.isPositive) {
        totalIncomeCents += movement.quantityCents;
        incomeCount++;
      } else {
        totalExpenseCents += movement.quantityCents;
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
