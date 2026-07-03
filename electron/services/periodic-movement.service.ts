import { PeriodicMovementT, TagT } from '@shared/types';
import { PeriodicMovement } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';
import { periodicMovementRepository } from '../repository/periodic-movement-repository.service';
import { movementRepository } from '../repository/movement-repository.service';
import { tagRepository } from '../repository/tag-repository.service';
import { accountRepository } from '../repository/account-repository.service';
import { categoryRepository } from '../repository/category-repository.service';
import { envelopeRepository } from '../repository/envelope-repository.service';
import { movementService } from './movement.service';

/** Fields the caller supplies on create; the rest (id, active, start anchor, cursor) are managed. */
type NewPeriodicTemplate = Omit<
  PeriodicMovementT,
  'id' | 'active' | 'lastCreatedYear' | 'lastCreatedMonth' | 'startYear' | 'startMonth'
>;

function nextPeriod(year: number, month: number): { year: number; month: number } {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

/** (y1,m1) <= (y2,m2) */
function periodLE(y1: number, m1: number, y2: number, m2: number): boolean {
  return y1 < y2 || (y1 === y2 && m1 <= m2);
}

export class PeriodicMovementService {
  create(fields: NewPeriodicTemplate, tagIds: number[] = []): number | bigint {
    this.validate(fields);
    if (periodicMovementRepository.getByName(fields.name.trim()) != undefined) {
      throw new AppError(AppErrorCode.PERIODIC_NAME_DUPLICATE);
    }
    const now = new Date();
    const id = periodicMovementRepository.insert({
      ...fields,
      name: fields.name.trim(),
      active: true,
      startYear: now.getFullYear(),
      startMonth: now.getMonth(),
      lastCreatedYear: null,
      lastCreatedMonth: null,
    });
    periodicMovementRepository.setTags(Number(id), tagIds);
    return id;
  }

  getAll(): PeriodicMovementT[] {
    return periodicMovementRepository.getAll();
  }

  getById(id: number): PeriodicMovementT | undefined {
    return periodicMovementRepository.getById(id);
  }

  getTagsForPeriodicMovement(id: number): TagT[] {
    return periodicMovementRepository
      .getTagIds(id)
      .map((tagId) => tagRepository.getTagById(tagId))
      .filter((t): t is TagT => t != undefined);
  }

  update(template: PeriodicMovementT, tagIds: number[] = []): boolean {
    this.validate(template);
    const byName = periodicMovementRepository.getByName(template.name.trim());
    if (byName != undefined && byName.id !== template.id) {
      throw new AppError(AppErrorCode.PERIODIC_NAME_DUPLICATE);
    }
    if (periodicMovementRepository.getById(template.id) == undefined) {
      throw new AppError(AppErrorCode.PERIODIC_NOT_FOUND);
    }
    const ok = periodicMovementRepository.update({ ...template, name: template.name.trim() });
    periodicMovementRepository.setTags(template.id, tagIds);
    return ok;
  }

  delete(id: number): boolean {
    if (periodicMovementRepository.getById(id) == undefined) {
      throw new AppError(AppErrorCode.PERIODIC_NOT_FOUND);
    }
    if (movementRepository.countByTemplate(id) > 0) {
      throw new AppError(AppErrorCode.PERIODIC_DELETE_HAS_INSTANCES);
    }
    return periodicMovementRepository.delete(id);
  }

  setActive(id: number, active: boolean): boolean {
    const template = periodicMovementRepository.getById(id);
    if (template == undefined) throw new AppError(AppErrorCode.PERIODIC_NOT_FOUND);
    // Reactivating: snap the cursor to the current month so the dormant gap is never back-filled.
    if (active) {
      const now = new Date();
      periodicMovementRepository.setCursor(id, now.getFullYear(), now.getMonth());
    }
    return periodicMovementRepository.setActive(id, active);
  }

  /** Frontend-triggered catch-up across all active templates. Returns the number of instances created. */
  generateDueForAll(): number {
    let count = 0;
    for (const t of periodicMovementRepository.getActive()) count += this.generateDue(t);
    return count;
  }

  /**
   * Generates every overdue instance for one template, walking the cursor forward. Past months are
   * always generated; the current month only once `today >= expectedDate`. Future months never.
   * Each instance is tentative and advances the cursor. Returns the number created.
   */
  private generateDue(t: PeriodicMovementT): number {
    const template = PeriodicMovement.from(t);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    let { year, month } =
      t.lastCreatedYear != null && t.lastCreatedMonth != null
        ? nextPeriod(t.lastCreatedYear, t.lastCreatedMonth)
        : { year: t.startYear, month: t.startMonth };

    let count = 0;
    while (periodLE(year, month, curYear, curMonth)) {
      if (year === curYear && month === curMonth && now < template.expectedDate(year, month)) {
        break; // current month not due yet
      }
      this.instantiate(template, template.expectedDate(year, month), true);
      periodicMovementRepository.setCursor(t.id, year, month);
      count++;
      ({ year, month } = nextPeriod(year, month));
    }
    return count;
  }

  /** Creates this month's instance early (born confirmed). Rejects future dates. */
  instantiateCurrentMonthEarly(
    id: number,
    date?: Date,
    amountCents?: number,
    envelopeIdMap?: Map<number, number>,
  ): number | bigint {
    const t = periodicMovementRepository.getById(id);
    if (t == undefined) throw new AppError(AppErrorCode.PERIODIC_NOT_FOUND);
    const now = new Date();
    const target = date ?? now;
    if (!(target instanceof Date) || isNaN(target.getTime())) {
      throw new AppError(AppErrorCode.MOVEMENT_DATE_INVALID);
    }
    if (target > now) throw new AppError(AppErrorCode.PERIODIC_DATE_FUTURE);

    // For this to be reachable the app is open, so startup's generateDueForAll has already caught the
    // cursor up — there is no backlog to fill here. If the cursor already covers the current month,
    // the instance exists (auto-generated) and there is nothing to create early.
    // (If a "pause/postpone generation" feature is added later, revisit whether to catch up here.)
    if (
      t.lastCreatedYear != null &&
      t.lastCreatedMonth != null &&
      periodLE(now.getFullYear(), now.getMonth(), t.lastCreatedYear, t.lastCreatedMonth)
    ) {
      throw new AppError(AppErrorCode.PERIODIC_ALREADY_INSTANTIATED);
    }

    const newId = this.instantiate(PeriodicMovement.from(t), target, false, amountCents, envelopeIdMap);
    periodicMovementRepository.setCursor(id, now.getFullYear(), now.getMonth());
    return newId;
  }

  /** Creates an extra confirmed instance without advancing the cursor. Rejects future dates. */
  createAdditionalInstance(
    id: number,
    date: Date,
    amountCents?: number,
    envelopeIdMap?: Map<number, number>,
  ): number | bigint {
    const t = periodicMovementRepository.getById(id);
    if (t == undefined) throw new AppError(AppErrorCode.PERIODIC_NOT_FOUND);
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new AppError(AppErrorCode.MOVEMENT_DATE_INVALID);
    }
    if (date > new Date()) throw new AppError(AppErrorCode.PERIODIC_DATE_FUTURE);
    return this.instantiate(PeriodicMovement.from(t), date, false, amountCents, envelopeIdMap);
  }

  /** Persists one instance through the movement service (so the guard/summary/overflow logic runs)
   *  and copies the template's tags onto it. */
  private instantiate(
    template: PeriodicMovement,
    date: Date,
    isTentative: boolean,
    amountCents?: number,
    envelopeIdMap?: Map<number, number>,
  ): number | bigint {
    const map = this.resolveInstanceMap(template, amountCents, envelopeIdMap);
    const mov = template.generateInstance(date, isTentative, amountCents, map);
    const newId = movementService.create(
      mov.name,
      mov.concept,
      mov.quantityCents,
      mov.isPositive,
      mov.date,
      mov.categoryId,
      mov.envelopeIdMap,
      mov.additionalNotes,
      mov.templateId,
      mov.isTentative,
      mov.accountId,
    );
    for (const tagId of periodicMovementRepository.getTagIds(template.id)) {
      tagRepository.addTagToMovement(tagId, Number(newId));
    }
    return newId;
  }

  /**
   * Resolves the envelope split for a generated instance. Default amount → copy the template's split
   * (returns undefined; the domain copies it). A caller-supplied split (custom amount adjusted in the
   * frontend) is used as-is. A custom amount with no explicit split can only be auto-applied to a
   * single-envelope template; a multi-envelope template needs the frontend to supply the new shares.
   */
  private resolveInstanceMap(
    template: PeriodicMovement,
    amountCents?: number,
    envelopeIdMap?: Map<number, number>,
  ): Map<number, number> | undefined {
    if (envelopeIdMap != undefined) return envelopeIdMap;
    if (amountCents == undefined || amountCents === template.quantityCents) return undefined;
    if (template.envelopeIdMap.size === 1) {
      const [envelopeId] = template.envelopeIdMap.keys();
      return new Map([[envelopeId, amountCents]]);
    }
    throw new AppError(AppErrorCode.MOVEMENT_SPLIT_SUM_MISMATCH);
  }

  /**
   * Asserts a template's fields produce a valid instance: required name, positive integer amount,
   * day-of-month in [1, 31], and references (account / category / envelope) that actually exist —
   * not merely positive ids, so a template can never point at a deleted entity.
   */
  private validate(fields: NewPeriodicTemplate): void {
    if (!fields.name.trim()) throw new AppError(AppErrorCode.PERIODIC_NAME_REQUIRED);
    if (!Number.isInteger(fields.quantityCents) || fields.quantityCents <= 0) {
      throw new AppError(AppErrorCode.PERIODIC_AMOUNT_INVALID);
    }
    if (!Number.isInteger(fields.dayOfMonth) || fields.dayOfMonth < 1 || fields.dayOfMonth > 31) {
      throw new AppError(AppErrorCode.PERIODIC_DAY_INVALID);
    }
    if (
      !Number.isInteger(fields.accountId) ||
      fields.accountId <= 0 ||
      accountRepository.getAccountById(fields.accountId) == undefined
    ) {
      throw new AppError(AppErrorCode.PERIODIC_ACCOUNT_REQUIRED);
    }
    if (
      !Number.isInteger(fields.categoryId) ||
      fields.categoryId <= 0 ||
      categoryRepository.getCategoryById(fields.categoryId) == undefined
    ) {
      throw new AppError(AppErrorCode.PERIODIC_CATEGORY_REQUIRED);
    }
    this.validateEnvelopeMap(fields.envelopeIdMap, fields.quantityCents);
  }

  /**
   * Validates a template's envelope split: non-empty, each envelope existing, each share a positive
   * integer, and the shares summing exactly to the template total. A single entry for a non-split template.
   */
  private validateEnvelopeMap(map: Map<number, number>, quantityCents: number): void {
    if (!(map instanceof Map) || map.size === 0) {
      throw new AppError(AppErrorCode.PERIODIC_ENVELOPE_REQUIRED);
    }
    let sum = 0;
    for (const [envelopeId, amount] of map) {
      if (
        !Number.isInteger(envelopeId) ||
        envelopeId <= 0 ||
        envelopeRepository.getEnvelopeById(envelopeId) == undefined
      ) {
        throw new AppError(AppErrorCode.PERIODIC_ENVELOPE_REQUIRED);
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new AppError(AppErrorCode.MOVEMENT_SPLIT_AMOUNT_INVALID);
      }
      sum += amount;
    }
    if (sum !== quantityCents) throw new AppError(AppErrorCode.MOVEMENT_SPLIT_SUM_MISMATCH);
  }
}

export const periodicMovementService = new PeriodicMovementService();
