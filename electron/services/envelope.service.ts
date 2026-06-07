import { DatabaseService } from '../repository/database.service';
import { envelopeRepository } from '../repository/envelope-repository.service';
import { Envelope } from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';

const db = DatabaseService.getInstance().db;

export function createEnvelope(name: string, accountId: number): number | bigint {
  if (!name.trim()) throw new AppError(AppErrorCode.ENVELOPE_NAME_REQUIRED);
  if (!accountId) throw new AppError(AppErrorCode.ENVELOPE_ACCOUNT_REQUIRED);
  return envelopeRepository.insertEnvelope({ name, accountId });
}

export function getAllEnvelopes(): Envelope[] {
  return envelopeRepository.getAllEnvelopes();
}

export function getEnvelopeById(id: number): Envelope | undefined {
  return envelopeRepository.getEnvelopeById(id);
}

export function updateEnvelope(envelope: Envelope): boolean {
  if (!envelope.name.trim()) throw new AppError(AppErrorCode.ENVELOPE_NAME_REQUIRED);
  return envelopeRepository.updateEnvelope(envelope);
}

export function deleteEnvelope(id: number): boolean {
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

  const tx = db.transaction((fromId: number, toId: number) => {
    envelopeRepository.reassignMovements(fromId, toId);
    return envelopeRepository.deleteEnvelope(fromId);
  });
  return tx(id, defaultId);
}

export function setDefaultEnvelope(id: number): void {
  envelopeRepository.setDefault(id);
}
