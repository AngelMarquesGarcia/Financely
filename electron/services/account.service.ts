import { DatabaseService } from '../repository/database.service';
import { accountRepository } from '../repository/account-repository.service';
import { envelopeRepository } from '../repository/envelope-repository.service';
import { AccountT, AccountStats } from '@shared/types';
import { Account } from '@shared/domain';
import { AppError, AppErrorCode } from '@shared/error-codes';

export class AccountService {
  private readonly db = DatabaseService.getInstance().db;

  create(name: string, description?: string, startingBalance = 0): number | bigint {
    if (!name.trim()) throw new AppError(AppErrorCode.ACCOUNT_NAME_REQUIRED);

    const tx = this.db.transaction((n: string, d: string | undefined, sb: number) => {
      const accountId = Number(accountRepository.insertAccount({ name: n, description: d, startingBalance: sb }));
      const envelopeId = Number(envelopeRepository.insertEnvelope({ name: n, accountId, startingBalance: 0 }));
      envelopeRepository.setDefault(envelopeId);
      return accountId;
    });
    return tx(name, description, startingBalance);
  }

  getAll(): AccountT[] {
    return accountRepository.getAllAccounts();
  }

  getById(id: number): AccountT | undefined {
    return accountRepository.getAccountById(id);
  }

  update(account: Account): boolean {
    if (!account.name.trim()) throw new AppError(AppErrorCode.ACCOUNT_NAME_REQUIRED);
    return accountRepository.updateAccount(account);
  }

  delete(id: number): boolean {
    if (accountRepository.isDefault(id)) {
      throw new AppError(AppErrorCode.ACCOUNT_DELETE_DEFAULT);
    }
    return accountRepository.deleteAccount(id);
  }

  setDefault(id: number): void {
    accountRepository.setDefault(id);
  }

  getStats(): AccountStats {
    return accountRepository.getStats();
  }
}

export const accountService = new AccountService();
