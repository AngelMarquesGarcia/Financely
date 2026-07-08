import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CompoundsListComponent } from './compounds-list.component';
import { CompoundMovementT } from '@shared/types';

function makeCompound(over: Partial<CompoundMovementT> = {}): CompoundMovementT {
  return {
    id: 1,
    accountId: 1,
    name: 'Trip',
    isCancelable: false,
    ownerYear: 2026,
    ownerMonth: 3,
    isAnomalous: false,
    notes: null,
    ...over,
  };
}

describe('CompoundsListComponent', () => {
  function create() {
    return TestBed.configureTestingModule({
      imports: [CompoundsListComponent],
    }).createComponent(CompoundsListComponent);
  }

  it('renders the empty state with no compounds', () => {
    const fixture = create();
    fixture.componentInstance.compounds = [];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).not.toBeNull();
  });

  it('ownerLabel formats the owner month', () => {
    const fixture = create();
    expect(fixture.componentInstance.ownerLabel(makeCompound({ ownerMonth: 3 }))).toBe('April 2026');
  });

  it('ownerLabel reads "Yearly" for a null owner', () => {
    const fixture = create();
    expect(
      fixture.componentInstance.ownerLabel(makeCompound({ ownerYear: null, ownerMonth: null })),
    ).toBe('Yearly');
  });

  it('childCount reads from the counts map', () => {
    const fixture = create();
    fixture.componentInstance.childCounts = { 1: 3 };
    expect(fixture.componentInstance.childCount(makeCompound({ id: 1 }))).toBe(3);
  });

  it('renders a row with the type badge', () => {
    const fixture = create();
    fixture.componentInstance.compounds = [makeCompound({ name: 'Dinner', isCancelable: true })];
    fixture.componentInstance.childCounts = { 1: 2 };
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Dinner');
    expect(text).toContain('cancelable');
  });
});
