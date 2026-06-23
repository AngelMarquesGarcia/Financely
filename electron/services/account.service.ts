import { DatabaseService } from '../repository/database.service';
import { accountRepository } from '../repository/account-repository.service';
import { envelopeRepository } from '../repository/envelope-repository.service';
import { Account, AccountStats } from '@shared/types';
import { AppError, AppErrorCode } from '@shared/error-codes';

const db = DatabaseService.getInstance().db;

export function createAccount(name: string, description?: string, startingBalance = 0): number | bigint {
  if (!name.trim()) throw new AppError(AppErrorCode.ACCOUNT_NAME_REQUIRED);

  // Transaction: insert account, then create + flag a default envelope for it.
  const tx = db.transaction((n: string, d: string | undefined, sb: number) => {
    const accountId = Number(accountRepository.insertAccount({ name: n, description: d, startingBalance: sb }));
    const envelopeId = Number(envelopeRepository.insertEnvelope({ name: n, accountId, startingBalance: 0 }));
    envelopeRepository.setDefault(envelopeId);
    return accountId;
  });
  return tx(name, description, startingBalance);
}

export function getAllAccounts(): Account[] {
  return accountRepository.getAllAccounts();
}

export function getAccountById(id: number): Account | undefined {
  return accountRepository.getAccountById(id);
}

export function updateAccount(account: Account): boolean {
  if (!account.name.trim()) throw new AppError(AppErrorCode.ACCOUNT_NAME_REQUIRED);
  return accountRepository.updateAccount(account);
}

export function deleteAccount(id: number): boolean {
  if (accountRepository.isDefault(id)) {
    throw new AppError(AppErrorCode.ACCOUNT_DELETE_DEFAULT);
  }
  // Schema cascades envelopes -> movements -> movement_tags.
  return accountRepository.deleteAccount(id);
}

export function setDefaultAccount(id: number): void {
  accountRepository.setDefault(id);
}

export function getAccountStats(): AccountStats {
  return accountRepository.getStats();
}
