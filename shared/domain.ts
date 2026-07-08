import type {
  PeriodT,
  MovementT,
  CompoundMovementT,
  PeriodSummaryT,
  PeriodicMovementT,
  AccountT,
  CategoryT,
  EnvelopeT,
  TagT,
  TransferT,
  DirtyState,
  BasicSummary,
} from './types';

export class Period implements PeriodT {
  constructor(
    public readonly accountId: number,
    public readonly envelopeId: number | null,
    public readonly year: number,
    public readonly month: number,
  ) {}

  getPrevious(): Period {
    if (this.month === 0) return new Period(this.accountId, this.envelopeId, this.year - 1, 11);
    return new Period(this.accountId, this.envelopeId, this.year, this.month - 1);
  }

  getNext(): Period {
    if (this.month === 11) return new Period(this.accountId, this.envelopeId, this.year + 1, 0);
    return new Period(this.accountId, this.envelopeId, this.year, this.month + 1);
  }

  static from(d: PeriodT): Period {
    return new Period(d.accountId, d.envelopeId, d.year, d.month);
  }

  static fromMovement(m: MovementT, envelopeId: number | null): Period {
    return new Period(m.accountId, envelopeId, m.date.getFullYear(), m.date.getMonth());
  }

  static fromPeriodSummary(ps: PeriodSummaryT): Period {
    return new Period(ps.accountId, ps.envelopeId, ps.year, ps.month);
  }
}

export class Movement implements MovementT {
  constructor(
    public readonly id: number,
    public readonly accountId: number,
    public readonly name: string,
    public readonly concept: string | null,
    public readonly quantityCents: number,
    public readonly isPositive: boolean,
    public readonly date: Date,
    public readonly categoryId: number,
    public readonly envelopeIdMap: Map<number, number>,
    public readonly additionalNotes: string | null,
    public readonly templateId: number | null = null,
    public readonly isTentative: boolean = false,
    public readonly isAnomalous: boolean = false,
    public readonly parentId: number | null = null,
  ) {}

  /** True when the movement is divided across more than one envelope. */
  isSplitMovement(): boolean {
    return this.envelopeIdMap.size > 1;
  }

  /** This movement's allocation to a given envelope, or undefined if it isn't attributed there. */
  amountFor(envelopeId: number): number | undefined {
    return this.envelopeIdMap.get(envelopeId);
  }

  /** One period per envelope the movement is attributed to (a split touches several), plus the
   *  account-level period (`envelopeId = null`) so account summaries are maintained on every change. */
  getPeriods(): Period[] {
    const envelopePeriods = [...this.envelopeIdMap.keys()].map((envelopeId) =>
      Period.fromMovement(this, envelopeId),
    );
    return [...envelopePeriods, Period.fromMovement(this, null)];
  }

  isPeriodic(): boolean {
    return this.templateId != null;
  }

  static from(d: MovementT): Movement {
    return new Movement(
      d.id,
      d.accountId,
      d.name,
      d.concept,
      d.quantityCents,
      d.isPositive,
      d.date,
      d.categoryId,
      d.envelopeIdMap,
      d.additionalNotes,
      d.templateId,
      d.isTentative,
      d.isAnomalous,
      d.parentId,
    );
  }
}

export class CompoundMovement implements CompoundMovementT {
  constructor(
    public readonly id: number,
    public readonly accountId: number,
    public readonly name: string,
    public readonly isCancelable: boolean,
    public readonly ownerYear: number | null,
    public readonly ownerMonth: number | null,
    public readonly isAnomalous: boolean,
    public readonly notes: string | null,
  ) {}

  /** True when the compound anchors its statistics to a specific month (both fields set together). */
  hasOwnerMonth(): boolean {
    return this.ownerYear != null && this.ownerMonth != null;
  }

  static from(d: CompoundMovementT): CompoundMovement {
    return new CompoundMovement(
      d.id,
      d.accountId,
      d.name,
      d.isCancelable,
      d.ownerYear,
      d.ownerMonth,
      d.isAnomalous,
      d.notes,
    );
  }
}

export class PeriodSummary implements PeriodSummaryT {
  constructor(
    public readonly accountId: number,
    public readonly envelopeId: number | null,
    public readonly accountName: string,
    public readonly envelopeName: string | null,
    public readonly year: number,
    public readonly month: number,
    public readonly cashFlowCents: number,
    public readonly totalIncomeCents: number,
    public readonly totalExpenseCents: number,
    public readonly avgExpenseCents: number,
    public readonly avgIncomeCents: number,
    public readonly avgMovementAmountCents: number,
    public readonly movementCount: number,
    public readonly endingBalanceCents: number,
    public readonly netTransfersCents: number,
    public readonly budgetCents: number | undefined,
    public readonly maxSavingsCents: number | undefined,
    public readonly notes: string | undefined,
    public readonly dirtyState: DirtyState,
    public readonly tentative: boolean = false,
    public readonly summaryWithoutAnomalies: BasicSummary | null = null,
    public readonly summaryCompoundAdjusted: BasicSummary | null = null,
    public readonly summaryCompoundAdjustedWithoutAnomalies: BasicSummary | null = null,
  ) {}

  getPeriod(): Period {
    return Period.fromPeriodSummary(this);
  }

  getAvailableBudget() {
    return (this.budgetCents ?? this.totalExpenseCents) - this.totalExpenseCents;
  }

  static from(d: PeriodSummaryT): PeriodSummary {
    return new PeriodSummary(
      d.accountId,
      d.envelopeId,
      d.accountName,
      d.envelopeName,
      d.year,
      d.month,
      d.cashFlowCents,
      d.totalIncomeCents,
      d.totalExpenseCents,
      d.avgExpenseCents,
      d.avgIncomeCents,
      d.avgMovementAmountCents,
      d.movementCount,
      d.endingBalanceCents,
      d.netTransfersCents,
      d.budgetCents,
      d.maxSavingsCents,
      d.notes,
      d.dirtyState,
      d.tentative,
      d.summaryWithoutAnomalies,
      d.summaryCompoundAdjusted,
      d.summaryCompoundAdjustedWithoutAnomalies,
    );
  }
}

export class Account implements AccountT {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string | undefined,
    public readonly isDefault: boolean,
    public readonly startingBalance: number,
  ) {}

  static from(d: AccountT): Account {
    return new Account(d.id, d.name, d.description, d.isDefault, d.startingBalance);
  }
}

export class Category implements CategoryT {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly color: string | undefined,
    public readonly emoji: string | undefined,
    public readonly envelopeId: number | null,
    public readonly isDefault: boolean,
    public readonly movementCount: number | undefined,
  ) {}

  static from(d: CategoryT): Category {
    return new Category(d.id, d.name, d.color, d.emoji, d.envelopeId, d.isDefault, d.movementCount);
  }
}

export class Envelope implements EnvelopeT {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly accountId: number | null,
    public readonly isDefault: boolean,
    public readonly startingBalance: number,
    public readonly budgetCents: number | null,
    public readonly maxSavingsCents: number | null,
    public readonly overflowsTo: number | null,
  ) {}

  static from(d: EnvelopeT): Envelope {
    return new Envelope(
      d.id,
      d.name,
      d.accountId,
      d.isDefault,
      d.startingBalance,
      d.budgetCents,
      d.maxSavingsCents,
      d.overflowsTo,
    );
  }
}

export class Tag implements TagT {
  constructor(
    public readonly id: number,
    public readonly type: string,
    public readonly name: string,
    public readonly color: string,
  ) {}

  static from(d: TagT): Tag {
    return new Tag(d.id, d.type, d.name, d.color);
  }
}

export class Transfer implements TransferT {
  constructor(
    public readonly id: number,
    public readonly fromEnvelopeId: number,
    public readonly toEnvelopeId: number,
    public readonly accountId: number,
    public readonly quantityCents: number,
    public readonly date: Date,
    public readonly isAuto: boolean,
    public readonly notes: string | null,
  ) {}

  /** The source envelope's period (money leaves here). */
  fromPeriod(): Period {
    return new Period(this.accountId, this.fromEnvelopeId, this.date.getFullYear(), this.date.getMonth());
  }

  /** The destination envelope's period (money arrives here). */
  toPeriod(): Period {
    return new Period(this.accountId, this.toEnvelopeId, this.date.getFullYear(), this.date.getMonth());
  }

  static from(d: TransferT): Transfer {
    return new Transfer(
      d.id,
      d.fromEnvelopeId,
      d.toEnvelopeId,
      d.accountId,
      d.quantityCents,
      d.date,
      d.isAuto,
      d.notes,
    );
  }
}

export class PeriodicMovement implements PeriodicMovementT {
  constructor(
    public readonly id: number,
    public readonly accountId: number,
    public readonly name: string,
    public readonly concept: string | null,
    public readonly quantityCents: number,
    public readonly isPositive: boolean,
    public readonly dayOfMonth: number,
    public readonly categoryId: number,
    public readonly envelopeIdMap: Map<number, number>,
    public readonly additionalNotes: string | null,
    public readonly active: boolean,
    public readonly startYear: number,
    public readonly startMonth: number,
    public readonly lastCreatedYear: number | null,
    public readonly lastCreatedMonth: number | null,
  ) {}

  /** Last calendar day of the given month (handles leap years). */
  lastDayOfMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  /** The expected instance date for a period, clamping the day to the month's length. */
  expectedDate(year: number, month: number): Date {
    return new Date(year, month, Math.min(this.dayOfMonth, this.lastDayOfMonth(year, month)));
  }

  /**
   * Builds (but does not persist) a real movement instance for the given date. Inherits the
   * template's account, category, sign and envelope split; `concept` falls back to the name; amount
   * defaults to the template's. `envelopeIdMap` overrides the template's default split (used for
   * custom-amount instances whose distribution the frontend supplied). Stamped with `templateId`.
   */
  generateInstance(
    date: Date,
    isTentative: boolean,
    amountCents?: number,
    envelopeIdMap?: Map<number, number>,
  ): Movement {
    return new Movement(
      -1,
      this.accountId,
      this.name,
      this.concept ?? this.name,
      amountCents ?? this.quantityCents,
      this.isPositive,
      date,
      this.categoryId,
      envelopeIdMap ? new Map(envelopeIdMap) : new Map(this.envelopeIdMap),
      this.additionalNotes,
      this.id,
      isTentative,
    );
  }

  static from(d: PeriodicMovementT): PeriodicMovement {
    return new PeriodicMovement(
      d.id,
      d.accountId,
      d.name,
      d.concept,
      d.quantityCents,
      d.isPositive,
      d.dayOfMonth,
      d.categoryId,
      d.envelopeIdMap,
      d.additionalNotes,
      d.active,
      d.startYear,
      d.startMonth,
      d.lastCreatedYear,
      d.lastCreatedMonth,
    );
  }
}
