import { BasicSummary, DirtyState, Movement, Period, PeriodSummary } from '@shared/types';
import { periodSummaryRepository } from '../repository/period-summary-repository.service';
import { getMovementById, getMovementsByPeriod } from './movement.service';
import { getAccountById } from './account.service';
import { getEnvelopeById } from './envelope.service';
import { AppError, AppErrorCode } from '@shared/error-codes';

export function createPeriodSummary(period: Period): number | bigint {
  if (checkPeriodSummaryExists(period)) throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
  const summary = calculatePeriodSummary(period);
  return periodSummaryRepository.insert(summary);
}

export function checkPeriodSummaryExists(period: Period): boolean {
  return periodSummaryRepository.getByPeriod(period) != undefined;
}

export function getAllPeriodSummaries(): PeriodSummary[] {
  return periodSummaryRepository.getAll();
}

export function getPeriodSummaryByPeriod(period: Period): PeriodSummary {
  const periodSummary = periodSummaryRepository.getByPeriod(period);
  if (periodSummary == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
  if (periodSummary.dirtyState != 'CLEAN') {
    const result = cleanPeriodSummary(periodSummary);
    if (result == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
    return result;
  }
  return periodSummary;
}

function cleanPeriodSummary(period: Period): PeriodSummary | undefined {
  const periodSummary = periodSummaryRepository.getByPeriod(period);
  if (periodSummary == undefined || periodSummary.dirtyState == 'CLEAN') return periodSummary;
  return cleanPeriodSummaryB(periodSummary);
}

function cleanPeriodSummaryB(periodSummary: PeriodSummary): PeriodSummary | undefined {
  //find the last dirty period, recalculate it, then recalculate all periods after.
  const period: Period = {
    accountId: periodSummary.accountId,
    envelopeId: periodSummary.envelopeId,
    year: periodSummary.year,
    month: periodSummary.month,
  }; //periodSummary.getPeriod()
  if (periodSummary == undefined || periodSummary.dirtyState == 'CLEAN') return periodSummary;

  const prevSum = cleanPeriodSummary({ ...period, month: period.month - 1 }); //period.previous()
  if (periodSummary.dirtyState == 'MODIFIED') {
    const updatedSum = { ...calculatePeriodSummary(period), id: periodSummary.id };
    periodSummaryRepository.update(updatedSum);
    return updatedSum;
  }
  if (prevSum == undefined) {
    throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
  }
  periodSummary.endingBalanceCents = prevSum.endingBalanceCents + periodSummary.cashFlowCents;
  periodSummary.dirtyState = 'CLEAN';
  periodSummaryRepository.update(periodSummary);
  return periodSummary;
}

export function recalculatePeriodSummaryFromMovement(updatedMovementId: number): number | bigint {
  //fetch the movement and get its Period, or get the period directly
  const mov = getMovementById(updatedMovementId);
  if (mov == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
  const period = getMovementPeriod(mov);
  return recalculatePeriodSummaryForPeriod(period);
}

export function recalculatePeriodSummaryForPeriod(period: Period): number | bigint {
  //
  const summary = calculatePeriodSummary(period);
  try {
    const previousPeriod = periodSummaryRepository.getByPeriod(period);
    if (previousPeriod == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
    return periodSummaryRepository.update({ ...summary, id: previousPeriod.id })
      ? previousPeriod.id
      : -1;
  } catch {
    return createPeriodSummary({
      accountId: summary.accountId,
      envelopeId: summary.envelopeId,
      year: summary.year,
      month: summary.month,
    });
  }
}

export function deletePeriodSummary(period: Period): boolean {
  return periodSummaryRepository.delete(period);
}

/** Upserts based on (accountId, envelopeId, year, month). Returns the id. */
export function upsertPeriodSummary(summary: Omit<PeriodSummary, 'id'>): number | bigint {
  const existing = periodSummaryRepository.getByPeriod({
    accountId: summary.accountId,
    envelopeId: summary.envelopeId ?? null,
    year: summary.year,
    month: summary.month,
  });
  if (existing) {
    periodSummaryRepository.update({ ...summary, id: existing.id });
    return existing.id;
  }
  return periodSummaryRepository.insert(summary);
}

export function updatePeriodSummary(summary: PeriodSummary): boolean {
  return periodSummaryRepository.update(summary);
}

export function editPeriodSummaryNotes(period: Period, notes: string) {
  const periodSum = periodSummaryRepository.getByPeriod(period);
  if (periodSum == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
  periodSum.notes = notes;
  periodSummaryRepository.update(periodSum);
}

export function markPeriodSummaryDirty(period: Period) {
  const periodSum = periodSummaryRepository.getByPeriod(period);
  if (periodSum == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
  periodSum.dirtyState = 'MODIFIED';
  periodSummaryRepository.update(periodSum);
  //mark all successive summaries dirty
  let i = 1;
  let nextSum = periodSummaryRepository.getByPeriod({ ...period, month: period.month + i }); //period.next()
  while (nextSum != undefined) {
    i++;
    nextSum.dirtyState = 'DIRTY';
    periodSummaryRepository.update(nextSum);
    nextSum = periodSummaryRepository.getByPeriod({ ...period, month: period.month + i }); //period.next()
  }
}

function getMovementPeriod(mov: Movement): Period {
  return {
    accountId: mov.accountId,
    envelopeId: mov.envelopeId,
    year: mov.date.getFullYear(),
    month: mov.date.getMonth(),
  };
}

function calculatePeriodSummary(period: Period): Omit<PeriodSummary, 'id'> {
  const movements = getMovementsByPeriod(period);
  const result = calculatePeriodSummaryFromMovements(movements);
  const prevPeriod = { ...period, month: period.month - 1 }; //period.previous()
  const prevPeriodSummary = periodSummaryRepository.getByPeriod(prevPeriod);
  if (prevPeriodSummary == undefined) {
    if (prevPeriod.envelopeId != undefined) {
      const envelope = getEnvelopeById(prevPeriod.envelopeId);
      if (envelope == undefined) throw new AppError(AppErrorCode.ENVELOPE_NOT_FOUND);
      result.endingBalanceCents = envelope.startingBalance + result.cashFlowCents;
    } else {
      const account = getAccountById(prevPeriod.accountId);
      if (account == undefined) throw new AppError(AppErrorCode.ACCOUNT_NOT_FOUND);
      result.endingBalanceCents = account.startingBalance + result.cashFlowCents;
    }
  } else result.endingBalanceCents = prevPeriodSummary.endingBalanceCents + result.cashFlowCents;
  return result;
}

function calculatePeriodSummaryFromMovements(movements: Movement[]): Omit<PeriodSummary, 'id'> {
  if (movements.length == 0) throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
  const accountId = movements[0].accountId;
  const envelopeId = movements[0].envelopeId;
  const accountName = getAccountById(accountId)?.name;
  const year = movements[0].date.getFullYear();
  const month = movements[0].date.getMonth();

  if (accountName == undefined) throw new AppError(AppErrorCode.ACCOUNT_NOT_FOUND);
  const envelope = getEnvelopeById(envelopeId);
  const envelopeName = envelope?.name ?? null;

  movements.forEach((m) => {
    if (m.accountId != accountId || m.envelopeId != envelopeId)
      throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
  });
  const sum = getBasicSummary(movements);
  const cashFlowCents = sum.cashFlowCents;
  const totalIncomeCents = sum.totalIncomeCents;
  const totalExpenseCents = sum.totalExpenseCents;
  const avgExpenseCents = sum.avgExpenseCents;
  const avgIncomeCents = sum.avgIncomeCents;
  const avgMovementAmountCents = sum.avgMovementAmountCents;
  const movementCount = sum.movementCount;
  //endingBalanceCents: number;
  //availableBudgetCents?: number | undefined;
  const notes = undefined;
  const dirtyState: DirtyState = 'CLEAN';

  let availableBudgetCents;
  if (envelopeId != undefined && envelope == undefined)
    throw new AppError(AppErrorCode.ENVELOPE_NOT_FOUND);
  else if (envelopeId != undefined) {
    availableBudgetCents = envelope!.fixedBudget - totalExpenseCents; // + any income that's not part of the fixed budget, but I'm as of yet unsure how that's best implemente.
  }

  return {
    accountId,
    envelopeId,
    accountName,
    envelopeName,
    year,
    month,
    cashFlowCents,
    totalIncomeCents,
    totalExpenseCents,
    avgExpenseCents,
    avgIncomeCents,
    avgMovementAmountCents,
    movementCount,
    availableBudgetCents,
    notes,
    dirtyState,
    endingBalanceCents: 0,
  };
}

function getBasicSummary(movements: Movement[]): BasicSummary {
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
