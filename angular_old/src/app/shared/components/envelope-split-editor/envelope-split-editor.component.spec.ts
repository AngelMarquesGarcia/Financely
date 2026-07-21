import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnvelopeSplitEditorComponent } from './envelope-split-editor.component';

describe('EnvelopeSplitEditorComponent', () => {
  function create(totalCents: number | null) {
    const fixture = TestBed.configureTestingModule({
      imports: [EnvelopeSplitEditorComponent],
    }).createComponent(EnvelopeSplitEditorComponent);
    fixture.componentRef.setInput('totalCents', totalCents);
    fixture.detectChanges(); // ngOnInit + first ngOnChanges
    return fixture;
  }

  it('is invalid until the shares sum to the total', () => {
    const fixture = create(2000);
    const comp = fixture.componentInstance;
    comp.rows = [
      { key: 1, envelopeId: 1, amountCents: 1500 },
      { key: 2, envelopeId: 2, amountCents: 400 },
    ];
    comp.onChange();
    expect(comp.isValid).toBe(false); // remaining 100
  });

  it('rejects a duplicate envelope even when the sum matches', () => {
    const fixture = create(2000);
    const comp = fixture.componentInstance;
    comp.rows = [
      { key: 1, envelopeId: 1, amountCents: 1000 },
      { key: 2, envelopeId: 1, amountCents: 1000 },
    ];
    comp.onChange();
    expect(comp.isValid).toBe(false);
  });

  it('re-emits validity when the total changes to match already-filled rows', () => {
    const fixture = create(null);
    const comp = fixture.componentInstance;
    const emitted: boolean[] = [];
    comp.validChange.subscribe((v) => emitted.push(v));

    // Rows are complete and sum to 2000, but the total is not set yet → invalid.
    comp.rows = [
      { key: 1, envelopeId: 1, amountCents: 1500 },
      { key: 2, envelopeId: 2, amountCents: 500 },
    ];
    comp.onChange();
    expect(comp.isValid).toBe(false);

    // Setting the total last must re-emit — this is the "won't create even though it matches" bug.
    fixture.componentRef.setInput('totalCents', 2000);
    fixture.detectChanges();
    expect(comp.isValid).toBe(true);
    expect(emitted.at(-1)).toBe(true);
  });
});
