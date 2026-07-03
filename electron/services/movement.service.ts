import { movementRepository } from '../repository/movement-repository.service';
import { accountRepository } from '../repository/account-repository.service';
import { MovementT, MovementFilter } from '@shared/types';
import { Movement, Period } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';
import { periodSummaryService } from './period-summary.service';
import { transferService } from './transfer.service';

export class MovementService {
  create(
    name: string,
    concept: string | null,
    quantityCents: number,
    isPositive: boolean,
    date: Date,
    categoryId: number,
    envelopeIdMap: Map<number, number>,
    additionalNotes: string | null,
    templateId: number | null = null,
    isTentative = false,
    accountId?: number,
  ): number | bigint {
    if (!name.trim()) throw new AppError(AppErrorCode.MOVEMENT_NAME_REQUIRED);
    if (!Number.isInteger(quantityCents) || quantityCents <= 0) {
      throw new AppError(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
    }
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new AppError(AppErrorCode.MOVEMENT_DATE_INVALID);
    }
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new AppError(AppErrorCode.MOVEMENT_CATEGORY_REQUIRED);
    }
    this.validateEnvelopeMap(envelopeIdMap, quantityCents);
    const resolvedAccountId = accountId ?? accountRepository.getDefaultId()!;
    const movement = new Movement(
      -1,
      resolvedAccountId,
      name,
      concept,
      quantityCents,
      isPositive,
      date,
      categoryId,
      envelopeIdMap,
      additionalNotes,
      templateId,
      isTentative,
    );
    // A confirmed movement may not open a new month while the previous one still has tentatives.
    if (!isTentative) this.assertPreviousMonthConfirmed(resolvedAccountId, date);
    const returnValue = movementRepository.insertMovement(movement);
    // Every envelope the movement is split across gets its period created/dirtied.
    const periods = movement.getPeriods();
    for (const period of periods) periodSummaryService.periodTouched(period);
    // Income may push an envelope over its savings cap — redirect the surplus per destination.
    // Deferred for tentative income (it has not really arrived yet); confirm() fires it later.
    if (isPositive && !isTentative) {
      for (const period of periods) transferService.redirectOverflowIfNeeded(period);
    }
    return returnValue;
  }

  /**
   * Validates a movement's envelope allocation: non-empty, each envelope/amount a positive integer,
   * and the shares summing exactly to the movement total. A non-split movement is a single entry.
   */
  private validateEnvelopeMap(map: Map<number, number>, quantityCents: number): void {
    if (!(map instanceof Map) || map.size === 0) {
      throw new AppError(AppErrorCode.MOVEMENT_ENVELOPE_REQUIRED);
    }
    let sum = 0;
    for (const [envelopeId, amount] of map) {
      if (!Number.isInteger(envelopeId) || envelopeId <= 0) {
        throw new AppError(AppErrorCode.MOVEMENT_SPLIT_ENVELOPE_INVALID);
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new AppError(AppErrorCode.MOVEMENT_SPLIT_AMOUNT_INVALID);
      }
      sum += amount;
    }
    if (sum !== quantityCents) throw new AppError(AppErrorCode.MOVEMENT_SPLIT_SUM_MISMATCH);
  }

  /** The suffix-invariant guard: throws if the account's previous month still holds a tentative. */
  private assertPreviousMonthConfirmed(accountId: number, date: Date): void {
    const prev = new Period(accountId, null, date.getFullYear(), date.getMonth()).getPrevious();
    if (movementRepository.hasTentativeInAccountMonth(accountId, prev.year, prev.month)) {
      throw new AppError(AppErrorCode.MOVEMENT_PREVIOUS_MONTH_TENTATIVE);
    }
  }

  /** Clears the tentative flag on a generated instance after the user reviews it. */
  confirm(id: number): boolean {
    const stored = movementRepository.getMovementById(id);
    if (stored == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
    if (!stored.isTentative) throw new AppError(AppErrorCode.MOVEMENT_NOT_TENTATIVE);
    const movement = Movement.from(stored);
    this.assertPreviousMonthConfirmed(movement.accountId, movement.date);
    const ok = movementRepository.confirm(id);
    // No aggregate changed — just refresh each envelope's tentative display flag (no markDirty).
    for (const period of movement.getPeriods()) {
      periodSummaryService.recomputeTentativeState(period);
      // Now that the income is confirmed, apply the previously-deferred over-cap redirect.
      if (movement.isPositive) transferService.redirectOverflowIfNeeded(period);
    }
    return ok;
  }

  getAll(filter?: MovementFilter): MovementT[] {
    return movementRepository.getAllMovements(filter);
  }

  getById(id: number): MovementT | undefined {
    return movementRepository.getMovementById(id);
  }

  getByPeriod(period: Period): MovementT[] {
    return movementRepository.getMovementsByPeriod(period);
  }

  update(movement: Movement): boolean {
    if (!movement.name.trim()) throw new AppError(AppErrorCode.MOVEMENT_NAME_REQUIRED);
    if (!Number.isInteger(movement.quantityCents) || movement.quantityCents <= 0) {
      throw new AppError(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
    }
    if (!(movement.date instanceof Date) || isNaN(movement.date.getTime())) {
      throw new AppError(AppErrorCode.MOVEMENT_DATE_INVALID);
    }
    this.validateEnvelopeMap(movement.envelopeIdMap, movement.quantityCents);

    // The split (and thus the affected envelopes) may change, so collect both the old and new
    // periods and refresh the union. Old envelopes recompute without the movement; new ones gain it.
    const stored = movementRepository.getMovementById(movement.id);
    const affected = new Map<string, Period>();
    const collect = (periods: Period[]) => {
      for (const p of periods) affected.set(`${p.accountId}-${p.envelopeId}-${p.year}-${p.month}`, p);
    };
    if (stored != undefined) collect(Movement.from(stored).getPeriods());
    collect(movement.getPeriods());

    const result = movementRepository.updateMovement(movement);
    for (const period of affected.values()) periodSummaryService.periodTouched(period);

    // Editing income (e.g. raising it) may push an envelope over its cap — re-check the redirect.
    // Gate on the STORED tentative state (update never changes it): a still-tentative instance
    // must not trigger a redirect before it is confirmed.
    if (movement.isPositive && stored != undefined && !stored.isTentative) {
      for (const period of movement.getPeriods()) transferService.redirectOverflowIfNeeded(period);
    }
    return result;
  }

  delete(id: number): boolean {
    const stored = movementRepository.getMovementById(id);
    if (stored == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
    const periods = Movement.from(stored).getPeriods();
    const ok = movementRepository.deleteMovement(id);
    for (const period of periods) {
      if (periodSummaryService.checkExists(period)) periodSummaryService.markDirty(period);
    }
    return ok;
  }

  deleteMany(ids: number[]): number {
    if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new AppError(AppErrorCode.MOVEMENT_ID_INVALID);
    }
    const periods = new Map<string, Period>();
    for (const id of ids) {
      const movement = movementRepository.getMovementById(id);
      if (movement != undefined) {
        for (const period of Movement.from(movement).getPeriods()) {
          periods.set(
            `${period.accountId}-${period.envelopeId}-${period.year}-${period.month}`,
            period,
          );
        }
      }
    }
    const count = movementRepository.deleteManyMovements(ids);
    for (const period of periods.values()) {
      if (periodSummaryService.checkExists(period)) periodSummaryService.markDirty(period);
    }
    return count;
  }

  suggestNames(prefix: string, limit?: number): string[] {
    return movementRepository.suggestNames(prefix, limit);
  }
}

export const movementService = new MovementService();
