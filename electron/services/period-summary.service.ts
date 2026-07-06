import { MovementT, PeriodSummaryT } from '@shared/types';
import { Movement, Period, PeriodSummary } from '@shared/domain';
import { periodSummaryRepository } from '../repository/period-summary-repository.service';
import { transferRepository } from '../repository/transfer-repository.service';
import { movementRepository } from '../repository/movement-repository.service';
import { movementService } from './movement.service';
import { accountService } from './account.service';
import { envelopeService } from './envelope.service';
import { computeBasicSummary } from './basic-summary';
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
    const result: PeriodSummaryT[] = [];
    for (const summary of periodSummaryRepository.getAll()) {
      if (summary.dirtyState === 'CLEAN') {
        result.push(summary);
        continue;
      }
      // Clean the dirty summary in place. `undefined` means it was an orphan — its last movement was
      // deleted, leaving a MODIFIED summary with no backing data, so cleaning self-deletes it. That is a
      // normal self-heal, not an error: correctly omit it rather than aborting the whole fetch.
      const cleaned = this.cleanPeriodSummary(Period.fromPeriodSummary(summary));
      if (cleaned) result.push(cleaned);
    }
    return result;
  }

  /**
   * Builds any missing period summaries from every existing movement (idempotent). Called once at
   * startup after migrate() — the seed inserts movements with raw SQL, bypassing the periodTouched
   * hook, so without this pass the period_summaries table would be empty and the overview blank.
   */
  backfillPeriodSummaries(): void {
    const periods = new Map<string, Period>();
    for (const mov of movementService.getAll()) {
      for (const period of Movement.from(mov).getPeriods()) {
        periods.set(`${period.accountId}-${period.envelopeId}-${period.year}-${period.month}`, period);
      }
    }
    for (const period of periods.values()) this.periodTouched(period);
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

  markDirty(period: Period, rechain = true): void {
    const periodSum = periodSummaryRepository.getByPeriod(period);
    if (periodSum == undefined) throw new AppError(AppErrorCode.PERIODSUMMARY_NOT_FOUND);
    periodSum.dirtyState = 'MODIFIED';
    periodSummaryRepository.update(periodSum);
    // Every later month's ending balance depends on this one — mark them all DIRTY (gap-safe). Skipped
    // when the edit left cash flow untouched (e.g. an anomalous-flag or notes-only change): the summary
    // still needs recomputing (MODIFIED, to refresh the mirror) but no later balance actually moves.
    if (rechain) periodSummaryRepository.markLaterDirty(period);
  }

  /** A movement or transfer landed in this period: create its summary if absent, else mark dirty. */
  periodTouched(period: Period, rechain = true) {
    const summary = periodSummaryRepository.getByPeriod(period);
    if (summary == undefined) {
      this.create(period);
      // A newly-created (possibly past) period shifts every later month's balance — re-chain them.
      if (rechain) periodSummaryRepository.markLaterDirty(period);
    } else {
      this.markDirty(period, rechain);
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

    const sum = computeBasicSummary(movements, period.envelopeId);
    // Recompute the same aggregates with anomalous movements excluded. null when the period has none:
    // the without-view then equals the all-inclusive fields, so nothing needs to be stored.
    const nonAnomalous = movements.filter((m) => !m.isAnomalous);
    const summaryWithoutAnomalies =
      nonAnomalous.length === movements.length
        ? null
        : computeBasicSummary(nonAnomalous, period.envelopeId);

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
      summaryWithoutAnomalies,
    };
  }
}

export const periodSummaryService = new PeriodSummaryService();
