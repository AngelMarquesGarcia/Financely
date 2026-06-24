import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MovementsListComponent } from './movements-list.component';
import { MovementT, CategoryT, EnvelopeT } from '@shared/types';

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
    envelopeId: 1,
    additionalNotes: null,
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
    const env: EnvelopeT = { id: 42, name: 'Savings', accountId: 1, isDefault: false, startingBalance: 0 };
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
    const env: EnvelopeT = { id: 1, name: 'Monthly', accountId: 1, isDefault: true, startingBalance: 0 };
    const cat: CategoryT = { id: 1, name: 'Food', isDefault: false, envelopeId: null };
    comp.envelopes = [env];
    comp.categories = [cat];
    comp.movements = [makeMovement({ envelopeId: 1, categoryId: 1 })];
    comp.movementTags = { 1: [] };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Monthly');
  });

  it('renders empty state when movements is empty', () => {
    const fixture = createComponent();
    fixture.componentInstance.movements = [];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).not.toBeNull();
  });
});
