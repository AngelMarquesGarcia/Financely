import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DIALOG_DATA } from '../../../core/services/dialog.tokens';
import { DialogRef } from '../../../core/services/dialog-ref';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { ImportResultT, MovementDraftT } from '@shared/types';

export type ImportPreviewData = { result: ImportResultT; accountName: string };

/** Issue codes that caused a row to be dropped from `drafts` (vs. informational fall-backs). */
const BLOCKING_CODES = new Set([
  'NAME_MISSING',
  'AMOUNT_INVALID',
  'DATE_INVALID',
  'SPLIT_SUM_MISMATCH',
]);

const ISSUE_LABELS: Record<string, string> = {
  TAG_WILL_CREATE: 'new tag(s) will be created',
  CATEGORY_NOT_FOUND: 'row(s) fell back to the default category',
  ENVELOPE_NOT_FOUND: 'row(s) fell back to the default envelope',
  TEMPLATE_NOT_FOUND: 'template label(s) not found — association dropped',
  GROUP_NOT_FOUND: 'group label(s) not found — association dropped',
  NAME_MISSING: 'row(s) skipped — no name or concept',
  AMOUNT_INVALID: 'row(s) skipped — invalid amount',
  DATE_INVALID: 'row(s) skipped — invalid date',
  SPLIT_SUM_MISMATCH: "row(s) skipped — split amounts don't add up",
};

/**
 * Read-only preview of a CSV import: shows the committable drafts and a summary of the issues found
 * (fall-backs, tags to create, skipped rows). Purely presentational — closes with `true` when the user
 * confirms; the caller runs `commitImport`.
 */
@Component({
  selector: 'app-import-preview-dialog',
  imports: [DatePipe, MoneyPipe],
  templateUrl: './import-preview-dialog.component.html',
  styleUrl: './import-preview-dialog.component.scss',
})
export class ImportPreviewDialogComponent {
  protected readonly data = inject<ImportPreviewData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean>);

  protected readonly drafts = this.data.result.drafts;
  protected readonly issueSummary = this.buildIssueSummary();

  private buildIssueSummary(): { code: string; count: number; label: string; blocking: boolean }[] {
    const counts = new Map<string, number>();
    for (const issue of this.data.result.issues) {
      counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([code, count]) => ({
        code,
        count,
        label: ISSUE_LABELS[code] ?? code,
        blocking: BLOCKING_CODES.has(code),
      }))
      .sort((a, b) => Number(b.blocking) - Number(a.blocking)); // blocking (skipped) first
  }

  /** Signed cents for display: positive stays positive, an expense renders negative. */
  protected signedCents(d: MovementDraftT): number {
    return d.isPositive ? d.quantityCents : -d.quantityCents;
  }

  protected envelopeLabel(d: MovementDraftT): string {
    if (d.envelopes.length === 1) return d.envelopes[0].name || '—';
    return d.envelopes.map((e) => `${e.name} (${(e.amountCents / 100).toFixed(2)})`).join(', ');
  }

  protected tagsLabel(d: MovementDraftT): string {
    return d.tags.map((t) => `${t.type}/${t.name}`).join(', ');
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected create(): void {
    this.dialogRef.close(true);
  }
}
