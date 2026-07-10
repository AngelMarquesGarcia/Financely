import { PeriodSummaryT, TransferT } from '@shared/types';
import { Transfer, Period } from '@shared/domain';
import { transferRepository } from '../repository/transfer-repository.service';
import { envelopeRepository } from '../repository/envelope-repository.service';
import { envelopeService } from './envelope.service';
import { periodSummaryService } from './period-summary.service';
import { AppError, AppErrorCode } from '@shared/error-codes';

export class TransferService {
  create(
    fromEnvelopeId: number,
    toEnvelopeId: number,
    quantityCents: number,
    date: Date,
    isAuto = false,
    notes: string | null = null,
  ): number | bigint {
    if (fromEnvelopeId === toEnvelopeId) throw new AppError(AppErrorCode.TRANSFER_SAME_ENVELOPE);
    if (!Number.isInteger(quantityCents) || quantityCents <= 0)
      throw new AppError(AppErrorCode.TRANSFER_AMOUNT_INVALID);
    if (!(date instanceof Date) || isNaN(date.getTime()))
      throw new AppError(AppErrorCode.TRANSFER_DATE_INVALID);

    const from = envelopeService.getById(fromEnvelopeId);
    if (from == undefined) throw new AppError(AppErrorCode.ENVELOPE_NOT_FOUND);
    const to = envelopeService.getById(toEnvelopeId);
    if (to == undefined) throw new AppError(AppErrorCode.ENVELOPE_NOT_FOUND);
    if (from.accountId == null || from.accountId !== to.accountId)
      throw new AppError(AppErrorCode.TRANSFER_CROSS_ACCOUNT);

    const accountId = from.accountId;
    const id = transferRepository.insert({
      fromEnvelopeId,
      toEnvelopeId,
      accountId,
      quantityCents,
      date,
      isAuto,
      notes,
    });

    // Both envelopes' summaries are affected (one loses, one gains) — touch each period.
    const year = date.getFullYear();
    const month = date.getMonth();
    periodSummaryService.periodTouched(new Period(accountId, fromEnvelopeId, year, month));
    periodSummaryService.periodTouched(new Period(accountId, toEnvelopeId, year, month));
    return id;
  }

  delete(id: number): boolean {
    const stored = transferRepository.getById(id);
    if (stored == undefined) throw new AppError(AppErrorCode.TRANSFER_NOT_FOUND);
    const ok = transferRepository.delete(id);
    if (ok) {
      // Re-touch both periods so their netTransfers recompute without the deleted row. A period left
      // with no movements and no transfers self-deletes on its next lazy clean.
      const t = Transfer.from(stored);
      periodSummaryService.periodTouched(t.fromPeriod());
      periodSummaryService.periodTouched(t.toPeriod());
    }
    return ok;
  }

  getAll(): TransferT[] {
    return transferRepository.getAll();
  }

  getForEnvelope(envelopeId: number): TransferT[] {
    return transferRepository.getForEnvelope(envelopeId);
  }

  /**
   * After income lands in an envelope, redirect any balance above `maxSavings + budget` to the
   * envelope's overflow target (or the account default). Only income movements call this — transfers
   * never do, so there is no cascade. No-op when the period has no summary, no cap, or no excess.
   */
  redirectOverflowIfNeeded(period: Period): void {
    const envelopeId = period.envelopeId;
    if (envelopeId == null) return;

    let summary: PeriodSummaryT;
    try {
      summary = periodSummaryService.getByPeriod(period);
    } catch {
      return; // no summary yet → nothing to redirect
    }
    if (summary.maxSavingsCents == null) return; // uncapped envelope

    const threshold = summary.maxSavingsCents + (summary.budgetCents ?? 0);
    const excess = summary.endingBalanceCents - threshold;
    if (excess <= 0) return;

    const envelope = envelopeService.getById(envelopeId);
    if (envelope == undefined) return;
    const target =
      envelope.overflowsTo ?? envelopeRepository.getDefaultForAccount(period.accountId);
    if (target == null || target === envelopeId) return; // nowhere to send / would self-loop

    this.create(envelopeId, target, excess, new Date(period.year, period.month, 1), true);
  }
}

export const transferService = new TransferService();
