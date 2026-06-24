import { movementRepository } from '../repository/movement-repository.service';
import { accountRepository } from '../repository/account-repository.service';
import { MovementT, MovementFilter } from '@shared/types';
import { Movement, Period } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';

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
    return movementRepository.insertMovement({
      accountId,
      name,
      concept,
      quantityCents,
      isPositive,
      date,
      categoryId,
      envelopeId,
      additionalNotes,
    });
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
    return movementRepository.updateMovement(movement);
  }

  delete(id: number): boolean {
    return movementRepository.deleteMovement(id);
  }

  deleteMany(ids: number[]): number {
    if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new AppError(AppErrorCode.MOVEMENT_ID_INVALID);
    }
    return movementRepository.deleteManyMovements(ids);
  }

  suggestNames(prefix: string, limit?: number): string[] {
    return movementRepository.suggestNames(prefix, limit);
  }
}

export const movementService = new MovementService();
