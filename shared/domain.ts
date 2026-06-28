import type {
  PeriodT,
  MovementT,
  PeriodSummaryT,
  AccountT,
  CategoryT,
  EnvelopeT,
  TagT,
  TransferT,
  DirtyState,
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

  static fromMovement(m: MovementT): Period {
    return new Period(m.accountId, m.envelopeId, m.date.getFullYear(), m.date.getMonth());
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
    public readonly envelopeId: number,
    public readonly additionalNotes: string | null,
  ) {}

  getPeriod(): Period {
    return Period.fromMovement(this);
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
      d.envelopeId,
      d.additionalNotes,
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
