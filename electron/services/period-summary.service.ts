import { BasicSummary, DirtyState, MovementT, PeriodSummaryT } from '@shared/types';
import { Period, PeriodSummary } from '@shared/domain';
import { periodSummaryRepository } from '../repository/period-summary-repository.service';
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

  movementCreatedInPeriod(period: Period) {
    const summary = periodSummaryRepository.getByPeriod(period);
    if (summary == undefined) this.create(period);
    else this.markDirty(period);
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
    periodSummary.endingBalanceCents = prevSum.endingBalanceCents + periodSummary.cashFlowCents;
    periodSummary.dirtyState = 'CLEAN';
    periodSummaryRepository.update(periodSummary);
    return periodSummary;
  }

  private calculatePeriodSummary(period: Period): PeriodSummaryT {
    const movements = movementService.getByPeriod(period);
    const result = this.calculatePeriodSummaryFromMovements(movements);
    const prevPeriodSummary = periodSummaryRepository.getByPeriod(period.getPrevious());
    if (prevPeriodSummary == undefined) {
      if (period.envelopeId != undefined) {
        const envelope = envelopeService.getById(period.envelopeId);
        if (envelope == undefined) throw new AppError(AppErrorCode.ENVELOPE_NOT_FOUND);
        result.endingBalanceCents = envelope.startingBalance + result.cashFlowCents;
      } else {
        const account = accountService.getById(period.accountId);
        if (account == undefined) throw new AppError(AppErrorCode.ACCOUNT_NOT_FOUND);
        result.endingBalanceCents = account.startingBalance + result.cashFlowCents;
      }
    } else {
      result.endingBalanceCents = prevPeriodSummary.endingBalanceCents + result.cashFlowCents;
    }
    return result;
  }

  private calculatePeriodSummaryFromMovements(movements: MovementT[]): PeriodSummaryT {
    if (movements.length == 0) throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
    const accountId = movements[0].accountId;
    const envelopeId = movements[0].envelopeId;
    const year = movements[0].date.getFullYear();
    const month = movements[0].date.getMonth();

    const accountName = accountService.getById(accountId)?.name;
    if (accountName == undefined) throw new AppError(AppErrorCode.ACCOUNT_NOT_FOUND);

    const envelope = envelopeService.getById(envelopeId);
    const envelopeName = envelope?.name ?? null;

    movements.forEach((m) => {
      if (m.accountId != accountId || m.envelopeId != envelopeId)
        throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
    });

    const sum = this.getBasicSummary(movements);
    const dirtyState: DirtyState = 'CLEAN';

    let availableBudgetCents;
    if (envelopeId != undefined && envelope == undefined)
      throw new AppError(AppErrorCode.ENVELOPE_NOT_FOUND);
    else if (envelopeId != undefined) {
      availableBudgetCents =
        (envelope as unknown as { fixedBudget: number }).fixedBudget - sum.totalExpenseCents;
    }

    return {
      accountId,
      envelopeId,
      accountName,
      envelopeName,
      year,
      month,
      cashFlowCents: sum.cashFlowCents,
      totalIncomeCents: sum.totalIncomeCents,
      totalExpenseCents: sum.totalExpenseCents,
      avgExpenseCents: sum.avgExpenseCents,
      avgIncomeCents: sum.avgIncomeCents,
      avgMovementAmountCents: sum.avgMovementAmountCents,
      movementCount: sum.movementCount,
      availableBudgetCents,
      notes: undefined,
      dirtyState,
      endingBalanceCents: 0,
    };
  }

  private getBasicSummary(movements: MovementT[]): BasicSummary {
    if (movements.length == 0) throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
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
    const avgMovementAmountCents = (totalIncomeCents + totalExpenseCents) / movementCount;

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
