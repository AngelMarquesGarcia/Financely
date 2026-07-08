import { CompoundMovementT, MovementT, NewCompoundChild, NewCompoundFields } from '@shared/types';
import { Movement } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';
import { compoundMovementRepository } from '../repository/compound-movement-repository.service';
import { movementRepository } from '../repository/movement-repository.service';
import { accountRepository } from '../repository/account-repository.service';
import { DatabaseService } from '../repository/database.service';
import { movementService } from './movement.service';
import { periodSummaryService } from './period-summary.service';

type YM = { year: number; month: number };

/**
 * Compound movements (CU1 grouping / CU2 cancelable). This service owns the entity and all membership
 * rules; the per-period statistical re-attribution driven by `ownerMonth` lives in the period-summary
 * layer. A compound never moves money — see the decision record for the invariants enforced here
 * (D2 anomaly inheritance, D6 cancelable-single-envelope, D11 owner-month, D12/D16 membership).
 */
export class CompoundMovementService {
  private readonly db = DatabaseService.getInstance().db;

  /**
   * Creates a compound from ≥2 children — existing movements (by id) and/or new ones created on the
   * spot. All children are forced onto one account; a cancelable compound additionally requires one
   * shared envelope. Atomic.
   */
  create(
    fields: NewCompoundFields,
    existingChildIds: number[] = [],
    newChildren: NewCompoundChild[] = [],
  ): number | bigint {
    if (!fields.name.trim()) throw new AppError(AppErrorCode.COMPOUND_NAME_REQUIRED);
    if (existingChildIds.length + newChildren.length < 2) {
      throw new AppError(AppErrorCode.COMPOUND_TOO_FEW_CHILDREN);
    }

    const existing = existingChildIds.map((id) => {
      const m = movementRepository.getMovementById(id);
      if (m == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
      return m;
    });
    for (const nc of newChildren) this.assertNewChildShape(nc);

    const accountId =
      existing.length > 0 ? existing[0].accountId : accountRepository.getDefaultId()!;
    for (const m of existing) this.assertEligibleExisting(m, accountId);

    // Known before insert: the descriptors the cancelable-envelope and owner-month checks need.
    const envelopes = [
      ...existing.map((m) => this.onlyEnvelope(m.envelopeIdMap)),
      ...newChildren.map((nc) => this.onlyEnvelope(nc.envelopeIdMap)),
    ];
    const months: YM[] = [
      ...existing.map((m) => this.ymOf(m.date)),
      ...newChildren.map((nc) => this.ymOf(nc.date)),
    ];
    if (fields.isCancelable && new Set(envelopes).size > 1) {
      throw new AppError(AppErrorCode.COMPOUND_CANCELABLE_MULTI_ENVELOPE);
    }
    const owner = this.resolveOwner(fields.ownerYear, fields.ownerMonth, months);

    return this.db.transaction(() => {
      const compoundId = Number(
        compoundMovementRepository.insert({
          accountId,
          name: fields.name.trim(),
          isCancelable: fields.isCancelable,
          ownerYear: owner.year,
          ownerMonth: owner.month,
          isAnomalous: fields.isAnomalous,
          notes: fields.notes,
        }),
      );

      for (const nc of newChildren) {
        const newId = this.createChildMovement(nc, accountId, fields.isAnomalous);
        movementRepository.setParent(Number(newId), compoundId);
      }
      for (const id of existingChildIds) movementRepository.setParent(id, compoundId);

      // Existing children of an anomalous compound are forced anomalous (D2); new ones were born so.
      if (fields.isAnomalous) {
        for (const m of existing) if (!m.isAnomalous) this.forceChildAnomalous(m);
      }
      const compound = compoundMovementRepository.getById(compoundId)!;
      this.refreshCompoundStats(compound, movementRepository.getByParent(compoundId));
      return compoundId;
    })();
  }

  getAll(): CompoundMovementT[] {
    return compoundMovementRepository.getAll();
  }

  getById(id: number): CompoundMovementT | undefined {
    return compoundMovementRepository.getById(id);
  }

  /** Every member movement of the compound. */
  getChildren(id: number): MovementT[] {
    return movementRepository.getByParent(id);
  }

  /** Links an existing movement into the compound (D12 eligibility + D6 envelope + D2 inheritance). */
  addMember(compoundId: number, movementId: number): void {
    const compound = this.getCompoundOrThrow(compoundId);
    const movement = movementRepository.getMovementById(movementId);
    if (movement == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
    this.assertEligibleExisting(movement, compound.accountId);
    if (compound.isCancelable) this.assertMatchesCompoundEnvelope(compoundId, movement.envelopeIdMap);

    this.db.transaction(() => {
      movementRepository.setParent(movementId, compoundId);
      if (compound.isAnomalous && !movement.isAnomalous) this.forceChildAnomalous(movement);
      this.refreshCompoundStats(compound, [movementRepository.getMovementById(movementId)!]);
    })();
  }

  /** Creates a new movement directly inside the compound. */
  createMember(compoundId: number, child: NewCompoundChild): number | bigint {
    const compound = this.getCompoundOrThrow(compoundId);
    this.assertNewChildShape(child);
    if (compound.isCancelable) this.assertMatchesCompoundEnvelope(compoundId, child.envelopeIdMap);

    return this.db.transaction(() => {
      const newId = this.createChildMovement(child, compound.accountId, compound.isAnomalous);
      movementRepository.setParent(Number(newId), compoundId);
      this.refreshCompoundStats(compound, [movementRepository.getMovementById(Number(newId))!]);
      return newId;
    })();
  }

  /** Un-parents a member. Drops below two ⇒ the compound dissolves (survivor un-parented, D16a). */
  removeMember(compoundId: number, movementId: number): void {
    const compound = this.getCompoundOrThrow(compoundId);
    const movement = movementRepository.getMovementById(movementId);
    if (movement == undefined) throw new AppError(AppErrorCode.MOVEMENT_NOT_FOUND);
    if (movement.parentId !== compoundId) throw new AppError(AppErrorCode.COMPOUND_CHILD_NOT_MEMBER);

    this.db.transaction(() => {
      movementRepository.setParent(movementId, null);
      if (movementRepository.countByParent(compoundId) < 2) {
        const survivors = movementRepository.getByParent(compoundId);
        for (const child of survivors) movementRepository.setParent(child.id, null);
        compoundMovementRepository.delete(compoundId);
        // The set is gone: the removed member and any survivor now count normally in their months.
        for (const m of [movement, ...survivors]) this.refreshOwnPeriods(m);
        return;
      }
      // The removed child may have been the owner month's only member — re-anchor if needed (D11).
      this.revalidateOwnerMonth(compound);
      this.refreshCompoundStats(compoundMovementRepository.getById(compoundId)!, [movement]);
    })();
  }

  /** Updates editable fields (name, notes, cancelable, anomalous, owner month). Account is immutable. */
  update(compound: CompoundMovementT): boolean {
    const stored = compoundMovementRepository.getById(compound.id);
    if (stored == undefined) throw new AppError(AppErrorCode.COMPOUND_NOT_FOUND);
    if (!compound.name.trim()) throw new AppError(AppErrorCode.COMPOUND_NAME_REQUIRED);

    const children = movementRepository.getByParent(compound.id);
    if (compound.isCancelable) {
      const envs = new Set(children.map((m) => this.onlyEnvelope(m.envelopeIdMap)));
      if (envs.size > 1) throw new AppError(AppErrorCode.COMPOUND_CANCELABLE_MULTI_ENVELOPE);
    }
    this.assertOwnerValid(
      compound.ownerYear,
      compound.ownerMonth,
      children.map((m) => this.ymOf(m.date)),
    );

    return this.db.transaction(() => {
      const ok = compoundMovementRepository.update({
        ...compound,
        accountId: stored.accountId,
        name: compound.name.trim(),
      });
      if (compound.isAnomalous) {
        for (const m of children) if (!m.isAnomalous) this.forceChildAnomalous(m);
      }
      // Owner month / cancelable may have changed: recompute the children's and both owners' periods.
      this.refreshCompoundStats(compoundMovementRepository.getById(compound.id)!, children);
      periodSummaryService.touchCompoundOwnerPeriods(stored);
      return ok;
    })();
  }

  /**
   * Deletes the compound. With `deleteChildren` the member movements are deleted too; otherwise they
   * survive, un-parented, keeping their own `isAnomalous` (D16d). The compound row is removed first so
   * its `parent_id` FK un-parents the children (`SET NULL`) — that stops per-child deletion from
   * re-triggering the auto-dissolve on an already-gone compound.
   */
  delete(id: number, deleteChildren: boolean): boolean {
    const compound = compoundMovementRepository.getById(id);
    if (compound == undefined) throw new AppError(AppErrorCode.COMPOUND_NOT_FOUND);
    return this.db.transaction(() => {
      const children = movementRepository.getByParent(id);
      const ok = compoundMovementRepository.delete(id);
      if (deleteChildren) for (const child of children) movementService.delete(child.id);
      return ok;
    })();
  }

  // ── internals ─────────────────────────────────────────────────────────────────────────────────

  private getCompoundOrThrow(id: number): CompoundMovementT {
    const c = compoundMovementRepository.getById(id);
    if (c == undefined) throw new AppError(AppErrorCode.COMPOUND_NOT_FOUND);
    return c;
  }

  /** A selectable existing movement must be on the account and be a plain, unattached movement (D12). */
  private assertEligibleExisting(m: MovementT, accountId: number): void {
    if (m.accountId !== accountId) throw new AppError(AppErrorCode.COMPOUND_CROSS_ACCOUNT);
    if (m.envelopeIdMap.size !== 1) throw new AppError(AppErrorCode.COMPOUND_CHILD_SPLIT);
    if (m.templateId != null) throw new AppError(AppErrorCode.COMPOUND_CHILD_PERIODIC);
    if (m.isTentative) throw new AppError(AppErrorCode.COMPOUND_CHILD_TENTATIVE);
    if (m.parentId != null) throw new AppError(AppErrorCode.COMPOUND_CHILD_ALREADY_PARENTED);
  }

  private assertNewChildShape(child: NewCompoundChild): void {
    if (!(child.envelopeIdMap instanceof Map) || child.envelopeIdMap.size !== 1) {
      throw new AppError(AppErrorCode.COMPOUND_CHILD_SPLIT);
    }
    if (!(child.date instanceof Date) || isNaN(child.date.getTime())) {
      throw new AppError(AppErrorCode.MOVEMENT_DATE_INVALID);
    }
  }

  /** The single envelope a cancelable compound's children share, or undefined when it has none yet. */
  private assertMatchesCompoundEnvelope(compoundId: number, map: Map<number, number>): void {
    const children = movementRepository.getByParent(compoundId);
    if (children.length === 0) return;
    if (this.onlyEnvelope(children[0].envelopeIdMap) !== this.onlyEnvelope(map)) {
      throw new AppError(AppErrorCode.COMPOUND_CANCELABLE_MULTI_ENVELOPE);
    }
  }

  private createChildMovement(
    child: NewCompoundChild,
    accountId: number,
    parentAnomalous: boolean,
  ): number | bigint {
    return movementService.create(
      child.name,
      child.concept,
      child.quantityCents,
      child.isPositive,
      child.date,
      child.categoryId,
      child.envelopeIdMap,
      child.additionalNotes,
      parentAnomalous || (child.isAnomalous ?? false),
      null,
      false,
      accountId,
    );
  }

  /** Forces a child anomalous through the normal update path (refreshes its periods' anomaly mirror). */
  private forceChildAnomalous(m: MovementT): void {
    movementService.update(Movement.from({ ...m, isAnomalous: true }));
  }

  /**
   * Re-marks the compound-adjusted statistics MODIFIED for every period affected by a membership
   * change: each listed child's own periods (their re-attribution changed) plus the compound's
   * owner-month periods (the injection changed). Stats-only — no balance re-chain.
   */
  private refreshCompoundStats(compound: CompoundMovementT, children: MovementT[]): void {
    for (const child of children) this.refreshOwnPeriods(child);
    periodSummaryService.touchCompoundOwnerPeriods(compound);
  }

  private refreshOwnPeriods(m: MovementT): void {
    for (const period of Movement.from(m).getPeriods()) periodSummaryService.periodTouched(period, false);
  }

  private revalidateOwnerMonth(compound: CompoundMovementT): void {
    if (compound.ownerYear == null || compound.ownerMonth == null) return;
    const months = movementRepository.getByParent(compound.id).map((m) => this.ymOf(m.date));
    if (months.length === 0) return;
    const stillValid = months.some(
      (ym) => ym.year === compound.ownerYear && ym.month === compound.ownerMonth,
    );
    if (stillValid) return;
    const earliest = this.earliest(months);
    compoundMovementRepository.update({
      ...compound,
      ownerYear: earliest.year,
      ownerMonth: earliest.month,
    });
  }

  /** Validates an explicit owner month: null-together, and (when set) within the children's months. */
  private assertOwnerValid(y: number | null, mo: number | null, months: YM[]): void {
    if (y == null && mo == null) return;
    if (y == null || mo == null) throw new AppError(AppErrorCode.COMPOUND_OWNER_MONTH_INVALID);
    if (!months.some((ym) => ym.year === y && ym.month === mo)) {
      throw new AppError(AppErrorCode.COMPOUND_OWNER_MONTH_INVALID);
    }
  }

  /** Resolves the owner month at create: `undefined` ⇒ earliest child month; otherwise as validated. */
  private resolveOwner(
    y: number | null | undefined,
    mo: number | null | undefined,
    months: YM[],
  ): { year: number | null; month: number | null } {
    if (y === undefined && mo === undefined) return this.earliest(months);
    this.assertOwnerValid(y ?? null, mo ?? null, months);
    if (y == null || mo == null) return { year: null, month: null };
    return { year: y, month: mo };
  }

  private onlyEnvelope(map: Map<number, number>): number {
    return [...map.keys()][0];
  }

  private ymOf(date: Date): YM {
    return { year: date.getFullYear(), month: date.getMonth() };
  }

  private earliest(months: YM[]): YM {
    return months.reduce((a, b) =>
      b.year < a.year || (b.year === a.year && b.month < a.month) ? b : a,
    );
  }
}

export const compoundMovementService = new CompoundMovementService();
