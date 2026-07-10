import { movementRepository } from '../repository/movement-repository.service';
import { accountRepository } from '../repository/account-repository.service';
import { compoundMovementRepository } from '../repository/compound-movement-repository.service';
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
    isAnomalous = false,
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
      isAnomalous,
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

  /**
   * Whether an edit changes anything that feeds the ending-balance chain: the amount, its sign, the
   * month it lands in, or the per-envelope split (keys or amounts). When none of these changed, every
   * affected period's cash flow is identical, so later months need not be re-chained (see update()).
   */
  private balanceInputsChanged(stored: MovementT, next: Movement): boolean {
    if (stored.quantityCents !== next.quantityCents) return true;
    if (stored.isPositive !== next.isPositive) return true;
    if (
      stored.date.getFullYear() !== next.date.getFullYear() ||
      stored.date.getMonth() !== next.date.getMonth()
    ) {
      return true;
    }
    if (stored.envelopeIdMap.size !== next.envelopeIdMap.size) return true;
    for (const [envelopeId, amount] of next.envelopeIdMap) {
      if (stored.envelopeIdMap.get(envelopeId) !== amount) return true;
    }
    return false;
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
    // Account-level periods (null envelope) aren't scoped to one envelope — fetch the whole month.
    if (period.envelopeId == null) {
      return movementRepository.getMovementsByAccountMonth(
        period.accountId,
        period.year,
        period.month,
      );
    }
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
    // A parented movement must remain a valid compound child through the edit (D2/D6/D12).
    if (stored?.parentId != null) this.assertCompoundChildStillValid(stored, movement);
    // An edit that leaves cash flow untouched (only isAnomalous / name / concept / category / notes
    // changed) still needs each period recomputed to refresh its mirror, but must NOT re-chain later
    // months — no ending balance moves. Only balance-relevant changes warrant the propagation.
    const rechain = stored == undefined || this.balanceInputsChanged(stored, movement);
    const affected = new Map<string, Period>();
    const collect = (periods: Period[]) => {
      for (const p of periods)
        affected.set(`${p.accountId}-${p.envelopeId}-${p.year}-${p.month}`, p);
    };
    if (stored != undefined) collect(Movement.from(stored).getPeriods());
    collect(movement.getPeriods());

    const result = movementRepository.updateMovement(movement);
    for (const period of affected.values()) periodSummaryService.periodTouched(period, rechain);
    // A compound child's edit shifts its compound's owner-month collapsed stats (cross-period).
    this.touchCompoundOwner(stored?.parentId ?? null);

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
    if (stored.parentId != null) {
      this.dissolveIfBelowMinimum(stored.parentId);
      this.touchCompoundOwner(stored.parentId);
    }
    return ok;
  }

  deleteMany(ids: number[]): number {
    if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new AppError(AppErrorCode.MOVEMENT_ID_INVALID);
    }
    const periods = new Map<string, Period>();
    const parentIds = new Set<number>();
    for (const id of ids) {
      const movement = movementRepository.getMovementById(id);
      if (movement != undefined) {
        if (movement.parentId != null) parentIds.add(movement.parentId);
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
    for (const parentId of parentIds) {
      this.dissolveIfBelowMinimum(parentId);
      this.touchCompoundOwner(parentId);
    }
    return count;
  }

  /**
   * A parented movement must remain a valid compound child through an edit: it cannot opt out of an
   * anomalous parent (D2), cannot become a split (D12), and — under a cancelable compound — cannot
   * change the single envelope the set shares (D6).
   */
  private assertCompoundChildStillValid(stored: MovementT, next: Movement): void {
    const parentId = stored.parentId;
    if (parentId == null) return;
    const parent = compoundMovementRepository.getById(parentId);
    if (parent == undefined) return; // parent vanished; nothing to enforce
    if (parent.isAnomalous && !next.isAnomalous) {
      throw new AppError(AppErrorCode.COMPOUND_ANOMALY_CHILD_CONFLICT);
    }
    if (next.isSplitMovement()) throw new AppError(AppErrorCode.COMPOUND_CHILD_SPLIT);
    if (parent.isCancelable) {
      const before = [...stored.envelopeIdMap.keys()][0];
      const after = [...next.envelopeIdMap.keys()][0];
      if (before !== after) throw new AppError(AppErrorCode.COMPOUND_CANCELABLE_MULTI_ENVELOPE);
    }
  }

  /**
   * After a child leaves (deleted or un-parented) a compound with fewer than two members is
   * meaningless, so dissolve it. The surviving child, if any, is un-parented by the `parent_id` FK
   * (`ON DELETE SET NULL`) and keeps its own `isAnomalous` value (D16d).
   */
  private dissolveIfBelowMinimum(parentId: number): void {
    if (movementRepository.countByParent(parentId) < 2) {
      compoundMovementRepository.delete(parentId);
    }
  }

  /** Refreshes a compound's owner-month collapsed statistics after one of its children changed. No-op
   *  when the movement has no parent or the compound has since dissolved. */
  private touchCompoundOwner(parentId: number | null): void {
    if (parentId == null) return;
    const compound = compoundMovementRepository.getById(parentId);
    if (compound != undefined) periodSummaryService.touchCompoundOwnerPeriods(compound);
  }

  suggestNames(prefix: string, limit?: number): string[] {
    return movementRepository.suggestNames(prefix, limit);
  }
}

export const movementService = new MovementService();
