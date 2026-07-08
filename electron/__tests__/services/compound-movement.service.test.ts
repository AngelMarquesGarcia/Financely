import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unmock('better-sqlite3');

const tmpDir = path.join(os.tmpdir(), 'financely-test-compound');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
const dbPath = path.join(tmpDir, 'electron_database.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue(tmpDir) },
}));

import { DatabaseService } from '../../repository/database.service';
import { compoundMovementService } from '../../services/compound-movement.service';
import { movementService } from '../../services/movement.service';
import { accountService } from '../../services/account.service';
import { NewCompoundChild, NewCompoundFields } from '@shared/types';
import { Movement } from '@shared/domain';
import { AppErrorCode } from '@shared/error-codes';

const one = (envelopeId: number, amount: number) => new Map([[envelopeId, amount]]);

/** Category + three distinct seed envelopes, all on the default account. */
function refs() {
  const db = DatabaseService.getInstance().db;
  const catId = Number((db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: number }).id);
  const envs = db.prepare('SELECT id FROM envelopes ORDER BY id LIMIT 3').all() as { id: number }[];
  return { catId, env1: envs[0].id, env2: envs[1].id, env3: envs[2].id };
}

/** Creates a plain, confirmed movement and returns its id. */
function mov(
  name: string,
  date: Date,
  envId: number,
  amount = 1000,
  isPositive = false,
  isAnomalous = false,
): number {
  const { catId } = refs();
  return Number(
    movementService.create(name, null, amount, isPositive, date, catId, one(envId, amount), null, isAnomalous),
  );
}

const APR = new Date(2026, 3, 10);
const MAY = new Date(2026, 4, 10);
const JUN = new Date(2026, 5, 10);

const fields = (over: Partial<NewCompoundFields> = {}): NewCompoundFields => ({
  name: 'Trip',
  isCancelable: false,
  isAnomalous: false,
  notes: null,
  ...over,
});

describe('CompoundMovementService — creation & membership rules', () => {
  beforeAll(() => DatabaseService.getInstance().migrate());
  beforeEach(() => DatabaseService.getInstance().migrate());

  it('creates a compound from existing movements and parents them', () => {
    const { env1 } = refs();
    const a = mov('Fuel', APR, env1);
    const b = mov('Hotel', APR, env1);
    const id = Number(compoundMovementService.create(fields(), [a, b]));

    expect(id).toBeGreaterThan(0);
    expect(movementService.getById(a)?.parentId).toBe(id);
    expect(movementService.getById(b)?.parentId).toBe(id);
    expect(compoundMovementService.getChildren(id).map((m) => m.id).sort()).toEqual([a, b].sort());
  });

  it('creates a compound from brand-new children', () => {
    const { catId, env1 } = refs();
    const child = (name: string): NewCompoundChild => ({
      name, concept: null, quantityCents: 500, isPositive: false, date: APR,
      categoryId: catId, envelopeIdMap: one(env1, 500), additionalNotes: null,
    });
    const id = Number(compoundMovementService.create(fields(), [], [child('A'), child('B')]));
    const children = compoundMovementService.getChildren(id);
    expect(children.length).toBe(2);
    expect(children.every((m) => m.parentId === id)).toBe(true);
  });

  it('rejects fewer than two children', () => {
    const { env1 } = refs();
    const a = mov('Solo', APR, env1);
    expect(() => compoundMovementService.create(fields(), [a])).toThrow(
      AppErrorCode.COMPOUND_TOO_FEW_CHILDREN,
    );
  });

  it('rejects a blank name', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    expect(() => compoundMovementService.create(fields({ name: '  ' }), [a, b])).toThrow(
      AppErrorCode.COMPOUND_NAME_REQUIRED,
    );
  });

  it('rejects children on different accounts', () => {
    const db = DatabaseService.getInstance().db;
    const { env1, catId } = refs();
    const a = mov('OnDefault', APR, env1);
    const accB = Number(accountService.create('Bank B'));
    const envB = Number(
      (db.prepare('SELECT id FROM envelopes WHERE account_id = ? LIMIT 1').get(accB) as { id: number }).id,
    );
    const b = Number(
      movementService.create('OnB', null, 1000, false, APR, catId, one(envB, 1000), null, false, null, false, accB),
    );
    expect(() => compoundMovementService.create(fields(), [a, b])).toThrow(
      AppErrorCode.COMPOUND_CROSS_ACCOUNT,
    );
  });

  it('rejects a split movement as a child', () => {
    const { catId, env1, env2 } = refs();
    const split = Number(
      movementService.create('Split', null, 1000, false, APR, catId, new Map([[env1, 600], [env2, 400]]), null),
    );
    const b = mov('B', APR, env1);
    expect(() => compoundMovementService.create(fields(), [split, b])).toThrow(
      AppErrorCode.COMPOUND_CHILD_SPLIT,
    );
  });

  it('rejects a tentative movement as a child', () => {
    const { catId, env1 } = refs();
    const tentative = Number(
      movementService.create('Tent', null, 1000, false, APR, catId, one(env1, 1000), null, false, null, true),
    );
    const b = mov('B', APR, env1);
    expect(() => compoundMovementService.create(fields(), [tentative, b])).toThrow(
      AppErrorCode.COMPOUND_CHILD_TENTATIVE,
    );
  });

  it('rejects a movement already in another compound', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    const c = mov('C', APR, env1);
    compoundMovementService.create(fields(), [a, b]);
    expect(() => compoundMovementService.create(fields(), [a, c])).toThrow(
      AppErrorCode.COMPOUND_CHILD_ALREADY_PARENTED,
    );
  });

  it('rejects a cancelable compound whose children span envelopes', () => {
    const { env1, env2 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env2);
    expect(() => compoundMovementService.create(fields({ isCancelable: true }), [a, b])).toThrow(
      AppErrorCode.COMPOUND_CANCELABLE_MULTI_ENVELOPE,
    );
  });
});

describe('CompoundMovementService — owner month', () => {
  beforeEach(() => DatabaseService.getInstance().migrate());

  it('defaults the owner month to the earliest child month', () => {
    const { env1 } = refs();
    const a = mov('May', MAY, env1);
    const b = mov('Apr', APR, env1);
    const id = Number(compoundMovementService.create(fields(), [a, b]));
    const c = compoundMovementService.getById(id)!;
    expect({ y: c.ownerYear, m: c.ownerMonth }).toEqual({ y: 2026, m: 3 }); // April
  });

  it('accepts an explicit owner month within the children months', () => {
    const { env1 } = refs();
    const a = mov('Apr', APR, env1);
    const b = mov('May', MAY, env1);
    const id = Number(
      compoundMovementService.create(fields({ ownerYear: 2026, ownerMonth: 4 }), [a, b]),
    );
    expect(compoundMovementService.getById(id)?.ownerMonth).toBe(4);
  });

  it('rejects an owner month no child falls in', () => {
    const { env1 } = refs();
    const a = mov('Apr', APR, env1);
    const b = mov('May', MAY, env1);
    expect(() =>
      compoundMovementService.create(fields({ ownerYear: 2026, ownerMonth: 7 }), [a, b]),
    ).toThrow(AppErrorCode.COMPOUND_OWNER_MONTH_INVALID);
  });

  it('accepts a null owner month (both fields null)', () => {
    const { env1 } = refs();
    const a = mov('Apr', APR, env1);
    const b = mov('May', MAY, env1);
    const id = Number(
      compoundMovementService.create(fields({ ownerYear: null, ownerMonth: null }), [a, b]),
    );
    const c = compoundMovementService.getById(id)!;
    expect(c.ownerYear).toBeNull();
    expect(c.ownerMonth).toBeNull();
  });
});

describe('CompoundMovementService — anomaly inheritance (D2)', () => {
  beforeEach(() => DatabaseService.getInstance().migrate());

  it('forces existing children anomalous when the compound is anomalous', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    compoundMovementService.create(fields({ isAnomalous: true }), [a, b]);
    expect(movementService.getById(a)?.isAnomalous).toBe(true);
    expect(movementService.getById(b)?.isAnomalous).toBe(true);
  });

  it('forbids a child from opting out while the parent is anomalous', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    compoundMovementService.create(fields({ isAnomalous: true }), [a, b]);
    expect(() =>
      movementService.update(Movement.from({ ...movementService.getById(a)!, isAnomalous: false })),
    ).toThrow(AppErrorCode.COMPOUND_ANOMALY_CHILD_CONFLICT);
  });

  it('inherits anomalous onto a newly added member', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    const c = mov('C', APR, env1);
    const id = Number(compoundMovementService.create(fields({ isAnomalous: true }), [a, b]));
    compoundMovementService.addMember(id, c);
    expect(movementService.getById(c)?.isAnomalous).toBe(true);
  });
});

describe('CompoundMovementService — add / remove / dissolve', () => {
  beforeEach(() => DatabaseService.getInstance().migrate());

  it('addMember links an eligible movement', () => {
    const { env1 } = refs();
    const id = Number(compoundMovementService.create(fields(), [mov('A', APR, env1), mov('B', APR, env1)]));
    const c = mov('C', APR, env1);
    compoundMovementService.addMember(id, c);
    expect(movementService.getById(c)?.parentId).toBe(id);
  });

  it('addMember rejects an envelope mismatch on a cancelable compound', () => {
    const { env1, env2 } = refs();
    const id = Number(
      compoundMovementService.create(fields({ isCancelable: true }), [mov('A', APR, env1), mov('B', APR, env1)]),
    );
    const other = mov('Other', APR, env2);
    expect(() => compoundMovementService.addMember(id, other)).toThrow(
      AppErrorCode.COMPOUND_CANCELABLE_MULTI_ENVELOPE,
    );
  });

  it('removeMember un-parents a member while ≥2 remain', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    const c = mov('C', APR, env1);
    const id = Number(compoundMovementService.create(fields(), [a, b, c]));
    compoundMovementService.removeMember(id, c);
    expect(movementService.getById(c)?.parentId).toBeNull();
    expect(compoundMovementService.getById(id)).toBeDefined();
  });

  it('dissolves the compound when membership drops below two', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    const id = Number(compoundMovementService.create(fields(), [a, b]));
    compoundMovementService.removeMember(id, a);
    expect(compoundMovementService.getById(id)).toBeUndefined();
    expect(movementService.getById(b)?.parentId).toBeNull(); // survivor un-parented
  });

  it('re-anchors the owner month when its only child is removed', () => {
    const { env1 } = refs();
    const apr = mov('Apr', APR, env1);
    const may = mov('May', MAY, env1);
    const jun = mov('Jun', JUN, env1);
    const id = Number(compoundMovementService.create(fields(), [apr, may, jun])); // owner defaults to April
    compoundMovementService.removeMember(id, apr);
    expect(compoundMovementService.getById(id)?.ownerMonth).toBe(4); // May, earliest remaining
  });

  it('auto-dissolves when a child is deleted directly through the movement service', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    const id = Number(compoundMovementService.create(fields(), [a, b]));
    movementService.delete(a);
    expect(compoundMovementService.getById(id)).toBeUndefined();
    expect(movementService.getById(b)?.parentId).toBeNull();
  });
});

describe('CompoundMovementService — update & delete', () => {
  beforeEach(() => DatabaseService.getInstance().migrate());

  it('updates name and notes', () => {
    const { env1 } = refs();
    const id = Number(compoundMovementService.create(fields(), [mov('A', APR, env1), mov('B', APR, env1)]));
    const c = compoundMovementService.getById(id)!;
    compoundMovementService.update({ ...c, name: 'Asturias', notes: 'road trip' });
    const after = compoundMovementService.getById(id)!;
    expect(after.name).toBe('Asturias');
    expect(after.notes).toBe('road trip');
  });

  it('rejects flipping to cancelable when children span envelopes', () => {
    const { env1, env2 } = refs();
    const id = Number(compoundMovementService.create(fields(), [mov('A', APR, env1), mov('B', APR, env2)]));
    const c = compoundMovementService.getById(id)!;
    expect(() => compoundMovementService.update({ ...c, isCancelable: true })).toThrow(
      AppErrorCode.COMPOUND_CANCELABLE_MULTI_ENVELOPE,
    );
  });

  it('delete with deleteChildren removes the member movements', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    const id = Number(compoundMovementService.create(fields(), [a, b]));
    compoundMovementService.delete(id, true);
    expect(compoundMovementService.getById(id)).toBeUndefined();
    expect(movementService.getById(a)).toBeUndefined();
    expect(movementService.getById(b)).toBeUndefined();
  });

  it('delete without deleteChildren keeps orphans and their anomalous flag (D16d)', () => {
    const { env1 } = refs();
    const a = mov('A', APR, env1);
    const b = mov('B', APR, env1);
    const id = Number(compoundMovementService.create(fields({ isAnomalous: true }), [a, b]));
    compoundMovementService.delete(id, false);
    expect(compoundMovementService.getById(id)).toBeUndefined();
    const survivorA = movementService.getById(a)!;
    expect(survivorA.parentId).toBeNull();
    expect(survivorA.isAnomalous).toBe(true); // no auto-revert
  });
});
