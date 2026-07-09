import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  ImportPreviewDialogComponent,
  ImportPreviewData,
} from './import-preview-dialog.component';
import { DIALOG_DATA } from '../../../core/services/dialog.tokens';
import { DialogRef } from '../../../core/services/dialog-ref';
import { ImportResultT, MovementDraftT } from '@shared/types';

function draft(over: Partial<MovementDraftT> = {}): MovementDraftT {
  return {
    name: 'Coffee',
    concept: 'Coffee',
    quantityCents: 350,
    isPositive: false,
    date: new Date('2026-06-01T00:00:00'),
    categoryName: 'Food',
    categoryId: 1,
    envelopes: [{ name: 'Monthly Expenses', id: 1, amountCents: 350 }],
    tags: [],
    additionalNotes: null,
    isAnomalous: false,
    templateName: null,
    groupName: null,
    ...over,
  };
}

function setup(result: ImportResultT, accountName = 'Main') {
  const close = vi.fn();
  TestBed.configureTestingModule({
    imports: [ImportPreviewDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: { result, accountName } as ImportPreviewData },
      { provide: DialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(ImportPreviewDialogComponent);
  fixture.detectChanges();
  return { fixture, close };
}

describe('ImportPreviewDialogComponent', () => {
  it('shows the movement count and target account, and one row per draft', () => {
    const { fixture } = setup({ drafts: [draft(), draft({ name: 'Lunch' })], issues: [] });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.ipd__title')!.textContent).toContain('Import 2 movements into Main');
    expect(el.querySelectorAll('.ipd__table tbody tr')).toHaveLength(2);
  });

  it('summarizes issues by code with blocking ones first', () => {
    const { fixture } = setup({
      drafts: [draft()],
      issues: [
        { row: 0, code: 'TAG_WILL_CREATE' },
        { row: 1, code: 'CATEGORY_NOT_FOUND' },
        { row: 2, code: 'AMOUNT_INVALID' },
        { row: 3, code: 'AMOUNT_INVALID' },
      ],
    });
    const items = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.ipd__issue'),
    );
    expect(items).toHaveLength(3); // grouped by distinct code
    // Blocking (AMOUNT_INVALID ×2) sorts first and is styled as blocking.
    expect(items[0].classList.contains('ipd__issue--blocking')).toBe(true);
    expect(items[0].textContent).toContain('2');
  });

  it('disables Create and shows an empty message when there are no importable rows', () => {
    const { fixture } = setup({ drafts: [], issues: [{ row: 0, code: 'DATE_INVALID' }] });
    const el = fixture.nativeElement as HTMLElement;
    const createBtn = el.querySelector('.ipd__actions .btn--primary') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
    expect(el.querySelector('.ipd__empty')).not.toBeNull();
  });

  it('closes with true on Create and false on Cancel', () => {
    const { fixture, close } = setup({ drafts: [draft()], issues: [] });
    const el = fixture.nativeElement as HTMLElement;
    const [cancelBtn, createBtn] = Array.from(
      el.querySelectorAll('.ipd__actions .btn'),
    ) as HTMLButtonElement[];

    createBtn.click();
    expect(close).toHaveBeenCalledWith(true);

    cancelBtn.click();
    expect(close).toHaveBeenCalledWith(false);
  });
});
