import { DatabaseService } from '../repository/database.service';
import { envelopeRepository } from '../repository/envelope-repository.service';
import { periodSummaryRepository } from '../repository/period-summary-repository.service';
import { movementRepository } from '../repository/movement-repository.service';
import { periodSummaryService } from './period-summary.service';
import { EnvelopeT } from '@shared/types';
import { Envelope, Period } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';

export class EnvelopeService {
  private readonly db = DatabaseService.getInstance().db;

  create(
    name: string,
    accountId: number,
    startingBalance = 0,
    budgetCents: number | null = null,
    maxSavingsCents: number | null = null,
    overflowsTo: number | null = null,
  ): number | bigint {
    if (!name.trim()) throw new AppError(AppErrorCode.ENVELOPE_NAME_REQUIRED);
    if (!accountId) throw new AppError(AppErrorCode.ENVELOPE_ACCOUNT_REQUIRED);
    if (budgetCents != null && budgetCents < 0)
      throw new AppError(AppErrorCode.ENVELOPE_BUDGET_NEGATIVE);
    if (maxSavingsCents != null && maxSavingsCents < 0)
      throw new AppError(AppErrorCode.ENVELOPE_MAXSAVINGS_NEGATIVE);
    return envelopeRepository.insertEnvelope({
      name,
      accountId,
      startingBalance,
      budgetCents,
      maxSavingsCents,
      overflowsTo,
    });
  }

  getAll(): EnvelopeT[] {
    return envelopeRepository.getAllEnvelopes();
  }

  getById(id: number): EnvelopeT | undefined {
    return envelopeRepository.getEnvelopeById(id);
  }

  update(envelope: Envelope): boolean {
    if (!envelope.name.trim()) throw new AppError(AppErrorCode.ENVELOPE_NAME_REQUIRED);
    if (envelope.isDefault) throw new AppError(AppErrorCode.ENVELOPE_UPDATE_DEFAULT);
    if (envelope.budgetCents != null && envelope.budgetCents < 0)
      throw new AppError(AppErrorCode.ENVELOPE_BUDGET_NEGATIVE);
    if (envelope.maxSavingsCents != null && envelope.maxSavingsCents < 0)
      throw new AppError(AppErrorCode.ENVELOPE_MAXSAVINGS_NEGATIVE);
    if (envelope.overflowsTo === envelope.id)
      throw new AppError(AppErrorCode.ENVELOPE_OVERFLOWS_TO_SELF);
    const updated = envelopeRepository.updateEnvelope(envelope);
    if (updated) {
      // Re-stamp the budget + savings-cap snapshots on the current + future summaries; past months stay frozen.
      const now = new Date();
      periodSummaryRepository.stampEnvelopeSnapshot(
        envelope.id,
        envelope.budgetCents,
        envelope.maxSavingsCents,
        now.getFullYear(),
        now.getMonth(),
      );
    }
    return updated;
  }

  delete(id: number): boolean {
    if (envelopeRepository.isDefault(id)) {
      throw new AppError(AppErrorCode.ENVELOPE_DELETE_DEFAULT);
    }
    const accountId = envelopeRepository.getAccountId(id);
    if (accountId == null) {
      throw new AppError(AppErrorCode.ENVELOPE_NO_ACCOUNT);
    }
    const defaultId = envelopeRepository.getDefaultForAccount(accountId);
    if (defaultId == null) {
      throw new AppError(AppErrorCode.ENVELOPE_ACCOUNT_NO_DEFAULT);
    }

    // The doomed envelope's allocations move to the default — collect the default-envelope periods
    // they land in (before the move) so we can recompute their balances afterward.
    const affected = new Map<string, Period>();
    for (const m of movementRepository.getAllMovements({ envelopeId: id })) {
      const p = new Period(accountId, defaultId, m.date.getFullYear(), m.date.getMonth());
      affected.set(`${p.year}-${p.month}`, p);
    }

    const tx = this.db.transaction((fromId: number, toId: number) => {
      envelopeRepository.reassignMovements(fromId, toId);
      return envelopeRepository.deleteEnvelope(fromId);
    });
    const result = tx(id, defaultId);

    // Drop the deleted envelope's now-orphaned summaries, then refresh the default's balances so the
    // redirected money shows up immediately (create-or-dirty + re-chain later months).
    periodSummaryRepository.deleteAllForEnvelope(id);
    for (const period of affected.values()) periodSummaryService.periodTouched(period);
    return result;
  }

  setDefault(id: number): void {
    envelopeRepository.setDefault(id);
  }
}

export const envelopeService = new EnvelopeService();
