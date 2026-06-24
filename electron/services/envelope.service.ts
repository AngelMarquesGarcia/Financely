import { DatabaseService } from '../repository/database.service';
import { envelopeRepository } from '../repository/envelope-repository.service';
import { EnvelopeT } from '@shared/types';
import { Envelope } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';

export class EnvelopeService {
  private readonly db = DatabaseService.getInstance().db;

  create(name: string, accountId: number, startingBalance = 0): number | bigint {
    if (!name.trim()) throw new AppError(AppErrorCode.ENVELOPE_NAME_REQUIRED);
    if (!accountId) throw new AppError(AppErrorCode.ENVELOPE_ACCOUNT_REQUIRED);
    return envelopeRepository.insertEnvelope({ name, accountId, startingBalance });
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
    return envelopeRepository.updateEnvelope(envelope);
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

    const tx = this.db.transaction((fromId: number, toId: number) => {
      envelopeRepository.reassignMovements(fromId, toId);
      return envelopeRepository.deleteEnvelope(fromId);
    });
    return tx(id, defaultId);
  }

  setDefault(id: number): void {
    envelopeRepository.setDefault(id);
  }
}

export const envelopeService = new EnvelopeService();
