import { movementRepository } from '../repository/movement-repository.service';
import { accountRepository } from '../repository/account-repository.service';
import { MovementT, MovementFilter } from '@shared/types';
import { Movement, Period } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';
import { periodSummaryService } from './period-summary.service';

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
  ): number | bigint {
    if (!name.trim()) throw new AppError(AppErrorCode.MOVEMENT_NAME_REQUIRED);
    if (!Number.isInteger(quantityCents) || quantityCents < 0) {
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
    const accountId = accountRepository.getDefaultId()!;
    const movement = new Movement(
      -1,
      accountId,
      name,
      concept,
      quantityCents,
      isPositive,
      date,
      categoryId,
      envelopeId,
      additionalNotes,
    );
    const returnValue = movementRepository.insertMovement(movement);
    const period = Period.fromMovement(movement);
    periodSummaryService.movementCreatedInPeriod(period);
    return returnValue;
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
    if (!Number.isInteger(movement.quantityCents) || movement.quantityCents < 0) {
      throw new AppError(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
    }
    if (!(movement.date instanceof Date) || isNaN(movement.date.getTime())) {
      throw new AppError(AppErrorCode.MOVEMENT_DATE_INVALID);
    }
    periodSummaryService.markDirty(Period.fromMovement(movement));
    return movementRepository.updateMovement(movement);
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
        periods.set(`${period.accountId}-${period.envelopeId}-${period.year}-${period.month}`, period);
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
