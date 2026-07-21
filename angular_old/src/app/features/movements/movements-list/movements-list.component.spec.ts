import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MovementsListComponent } from './movements-list.component';
import { MovementT, CategoryT, CompoundMovementT, EnvelopeT } from '@shared/types';

function makeMovement(overrides: Partial<MovementT> = {}): MovementT {
  return {
    id: 1,
    accountId: 1,
    name: 'Test',
    concept: null,
    quantityCents: 1000,
    isPositive: true,
    date: new Date('2024-01-15'),
    categoryId: 1,
    envelopeIdMap: new Map([[1, 1000]]),
    additionalNotes: null,
    templateId: null,
    isTentative: false,
    isAnomalous: false,
    parentId: null,
    ...overrides,
  };
}

function makeCompound(overrides: Partial<CompoundMovementT> = {}): CompoundMovementT {
  return {
    id: 10,
    accountId: 1,
    name: 'Trip',
    isCancelable: false,
    ownerYear: 2024,
    ownerMonth: 0, // January
    isAnomalous: false,
    notes: null,
    ...overrides,
  };
}

describe('MovementsListComponent', () => {
  function createComponent() {
    const fixture = TestBed.configureTestingModule({
      imports: [MovementsListComponent],
    }).createComponent(MovementsListComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('getEnvelope returns matching envelope', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    const env: EnvelopeT = {
      id: 42,
      name: 'Savings',
      accountId: 1,
      isDefault: false,
      startingBalance: 0,
      budgetCents: null,
      maxSavingsCents: null,
      overflowsTo: null,
    };
    comp.envelopes = [env];
    expect(comp.getEnvelope(42)).toEqual(env);
  });

  it('getEnvelope returns undefined for unmatched id', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.getEnvelope(999)).toBeUndefined();
  });

  it('signedCents negates expenses', () => {
    const fixture = createComponent();
    const expense = makeMovement({ quantityCents: 500, isPositive: false });
    expect(fixture.componentInstance.signedCents(expense)).toBe(-500);
  });

  it('signedCents keeps income positive', () => {
    const fixture = createComponent();
    const income = makeMovement({ quantityCents: 500, isPositive: true });
    expect(fixture.componentInstance.signedCents(income)).toBe(500);
  });

  it('contrastColor returns dark color for light hex', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.contrastColor('#ffffff')).toBe('#0f172a');
  });

  it('contrastColor returns light color for dark hex', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance.contrastColor('#000000')).toBe('#ffffff');
  });

  it('renders envelope column name in table', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    const env: EnvelopeT = {
      id: 1,
      name: 'Monthly',
      accountId: 1,
      isDefault: true,
      startingBalance: 0,
      budgetCents: null,
      maxSavingsCents: null,
      overflowsTo: null,
    };
    const cat: CategoryT = { id: 1, name: 'Food', isDefault: false, envelopeId: null };
    comp.envelopes = [env];
    comp.categories = [cat];
    comp.movements = [makeMovement({ envelopeIdMap: new Map([[1, 1000]]), categoryId: 1 })];
    comp.movementTags = { 1: [] };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Monthly');
  });

  // ── split display (CU3) ────────────────────────────────────────────────────
  it('shows the full total and "Multiple" for a split when unscoped', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    const split = makeMovement({
      quantityCents: 2000,
      envelopeIdMap: new Map([
        [1, 1500],
        [2, 500],
      ]),
    });
    expect(comp.isSplit(split)).toBe(true);
    expect(comp.isPartial(split)).toBe(false);
    expect(comp.displayAmountCents(split)).toBe(2000);
    expect(comp.envelopeLabel(split)).toBe('Multiple');
  });

  it('shows the partial share when scoped to one envelope of a split', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    comp.envelopes = [
      {
        id: 2,
        name: 'Food',
        accountId: 1,
        isDefault: false,
        startingBalance: 0,
        budgetCents: null,
        maxSavingsCents: null,
        overflowsTo: null,
      },
    ];
    comp.scopedEnvelopeId = 2;
    const split = makeMovement({
      quantityCents: 2000,
      isPositive: false,
      envelopeIdMap: new Map([
        [1, 1500],
        [2, 500],
      ]),
    });
    expect(comp.isPartial(split)).toBe(true);
    expect(comp.displayAmountCents(split)).toBe(-500); // expense → negative partial share
    expect(comp.envelopeLabel(split)).toBe('Food');
  });

  it('renders empty state when movements is empty', () => {
    const fixture = createComponent();
    fixture.componentInstance.movements = [];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).not.toBeNull();
  });

  // ── compound movements (D15 visualization) ──────────────────────────────────
  it('collapses owner-month members into one compound group row', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    comp.compounds = [makeCompound()];
    comp.movements = [
      makeMovement({ id: 1, date: new Date(2024, 0, 5), parentId: 10 }),
      makeMovement({ id: 2, date: new Date(2024, 0, 20), parentId: 10 }),
    ];
    const rows = comp.groupedRows;
    const groupRows = rows.filter((r) => r.kind === 'compound');
    expect(groupRows).toHaveLength(1);
    expect(groupRows[0].kind === 'compound' && groupRows[0].monthChildren.length).toBe(2);
    // collapsed → the members are not emitted as their own rows
    expect(rows.some((r) => r.kind === 'movement')).toBe(false);
  });

  it('shows a member outside its owner month as a greyed inactive row', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    comp.compounds = [makeCompound({ ownerYear: 2024, ownerMonth: 0 })];
    comp.movements = [makeMovement({ id: 3, date: new Date(2024, 1, 10), parentId: 10 })]; // February
    const rows = comp.groupedRows;
    expect(rows.some((r) => r.kind === 'compound')).toBe(false);
    const movementRow = rows.find((r) => r.kind === 'movement');
    expect(movementRow?.kind === 'movement' && movementRow.inactive).toBe(true);
  });

  it('expands a group to reveal that month’s members as child rows', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    comp.compounds = [makeCompound()];
    comp.movements = [
      makeMovement({ id: 1, date: new Date(2024, 0, 5), parentId: 10 }),
      makeMovement({ id: 2, date: new Date(2024, 0, 20), parentId: 10 }),
    ];
    comp.toggleGroup(10);
    const rows = comp.groupedRows;
    expect(rows.some((r) => r.kind === 'compound' && r.expanded)).toBe(true);
    const childRows = rows.filter((r) => r.kind === 'movement' && r.childOf === 10);
    expect(childRows).toHaveLength(2);
  });

  it('ownerLabel reads "Yearly" for a null-owner compound', () => {
    const fixture = createComponent();
    expect(
      fixture.componentInstance.ownerLabel(makeCompound({ ownerYear: null, ownerMonth: null })),
    ).toBe('Yearly');
  });

  it('groupSubtotalCents sums signed member amounts', () => {
    const fixture = createComponent();
    const comp = fixture.componentInstance;
    const children = [
      makeMovement({ id: 1, quantityCents: 12000, isPositive: false }),
      makeMovement({ id: 2, quantityCents: 10000, isPositive: true }),
    ];
    expect(comp.groupSubtotalCents(children)).toBe(-2000);
  });
});
