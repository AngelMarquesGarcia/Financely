import { BasicSummary, MovementT } from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';

/**
 * A movement's contribution to a given scope. When `envelopeId` is null the movement counts at its
 * full amount (account-level or non-pool filter slices). Otherwise the per-envelope allocation must be
 * present — callers pass only movements attributed to that envelope, so a missing entry signals a
 * data-integrity bug rather than a legitimate case (a full-total fallback would over-count a split).
 */
export function amountForEnvelope(m: MovementT, envelopeId: number | null): number {
  if (envelopeId == null) return m.quantityCents;
  const amount = m.envelopeIdMap.get(envelopeId);
  if (amount == undefined) throw new AppError(AppErrorCode.INCORRECT_PARAMETERS);
  return amount;
}

/**
 * Aggregates a movement list into a BasicSummary. `envelopeId` selects per-envelope partial amounts (a
 * split contributes only its slice); null uses each movement's full amount, counted once. An empty
 * list yields all-zero aggregates.
 */
export function computeBasicSummary(
  movements: MovementT[],
  envelopeId: number | null = null,
): BasicSummary {
  let totalIncomeCents = 0;
  let incomeCount = 0;
  let totalExpenseCents = 0;
  let expenseCount = 0;
  for (const movement of movements) {
    const amount = amountForEnvelope(movement, envelopeId);
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
