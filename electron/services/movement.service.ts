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
    envelopeId: number,
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
    if (!Number.isInteger(envelopeId) || envelopeId <= 0) {
      throw new AppError(AppErrorCode.MOVEMENT_ENVELOPE_REQUIRED);
    }
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
      envelopeId,
      additionalNotes,
      templateId,
      isTentative,
    );
    // A confirmed movement may not open a new month while the previous one still has tentatives.
    if (!isTentative) this.assertPreviousMonthConfirmed(movement);
    const returnValue = movementRepository.insertMovement(movement);
    const period = Period.fromMovement(movement);
    periodSummaryService.periodTouched(period);
    // Income may push the envelope over its savings cap — redirect the surplus. Deferred for
    // tentative income (it has not really arrived yet); confirm() fires it later.
    if (isPositive && !isTentative) transferService.redirectOverflowIfNeeded(period);
    return returnValue;
  }

  /** The suffix-invariant guard: throws if the account's previous month still holds a tentative. */
  private assertPreviousMonthConfirmed(movement: Movement): void {
    const prev = Period.fromMovement(movement).getPrevious();
    if (movementRepository.hasTentativeInAccountMonth(movement.accountId, prev.year, prev.month)) {
      throw new AppError(AppErrorCode.MOVEMENT_PREVIOUS_MONTH_TENTATIVE);
    }
  }

  /** Clears the tentative flag on a generated instance after the user reviews it. */
  confirm(id: number): boolean {
    const stored = movementRepository.getMovementById(id);
    if (stored == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
    if (!stored.isTentative) throw new AppError(AppErrorCode.MOVEMENT_NOT_TENTATIVE);
    const movement = Movement.from(stored);
    const period = Period.fromMovement(movement);
    this.assertPreviousMonthConfirmed(movement);
    const ok = movementRepository.confirm(id);
    // No aggregate changed — just refresh the period's tentative display flag (no markDirty).
    periodSummaryService.recomputeTentativeState(period);
    // Now that the income is confirmed, apply the previously-deferred over-cap redirect.
    if (movement.isPositive) transferService.redirectOverflowIfNeeded(period);
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
    const period = Period.fromMovement(movement);
    periodSummaryService.markDirty(period);
    const result = movementRepository.updateMovement(movement);
    // Editing income (e.g. raising it) may push the envelope over its cap — re-check the redirect.
    // Gate on the STORED tentative state (update never changes it): a still-tentative instance
    // must not trigger a redirect before it is confirmed.
    const stored = movementRepository.getMovementById(movement.id);
    if (movement.isPositive && stored != undefined && !stored.isTentative) {
      transferService.redirectOverflowIfNeeded(period);
    }
    return result;
  }

  delete(id: number): boolean {
    const movement = movementRepository.getMovementById(id);
    if (movement == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
    periodSummaryService.markDirty(Period.fromMovement(movement));
    return movementRepository.deleteMovement(id);
  }

  deleteMany(ids: number[]): number {
    if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new AppError(AppErrorCode.MOVEMENT_ID_INVALID);
    }
    const periods = new Map<string, Period>();
    for (const id of ids) {
      const movement = movementRepository.getMovementById(id);
      if (movement != undefined) {
        const period = Period.fromMovement(movement);
        periods.set(
          `${period.accountId}-${period.envelopeId}-${period.year}-${period.month}`,
          period,
        );
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
