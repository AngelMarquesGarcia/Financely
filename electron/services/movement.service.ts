import { movementRepository } from '../repository/movement-repository.service';
import { accountRepository } from '../repository/account-repository.service';
import { Movement, MovementFilter, Period } from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';

export function createMovement(
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

export function getAllMovements(filter?: MovementFilter): Movement[] {
  return movementRepository.getAllMovements(filter);
}

export function getMovementById(id: number): Movement | undefined {
  return movementRepository.getMovementById(id);
}

export function getMovementsByPeriod(period: Period): Movement[] {
  return movementRepository.getMovementsByPeriod(period);
}

export function updateMovement(movement: Movement): boolean {
  if (!movement.name.trim()) throw new AppError(AppErrorCode.MOVEMENT_NAME_REQUIRED);
  if (!Number.isInteger(movement.quantityCents) || movement.quantityCents < 0) {
    throw new AppError(AppErrorCode.MOVEMENT_AMOUNT_INVALID);
  }
  if (!(movement.date instanceof Date) || isNaN(movement.date.getTime())) {
    throw new AppError(AppErrorCode.MOVEMENT_DATE_INVALID);
  }
  return movementRepository.updateMovement(movement);
}

export function deleteMovement(id: number): boolean {
  return movementRepository.deleteMovement(id);
}

export function deleteManyMovements(ids: number[]): number {
  if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new AppError(AppErrorCode.MOVEMENT_ID_INVALID);
  }
  return movementRepository.deleteManyMovements(ids);
}

export function suggestMovementNames(prefix: string, limit?: number): string[] {
  return movementRepository.suggestNames(prefix, limit);
}
