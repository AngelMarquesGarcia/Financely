import { Injectable } from '@angular/core';
import { AppErrorCode } from '@shared/error-codes';

const ERROR_MESSAGES: Record<string, string> = {
  [AppErrorCode.MOVEMENT_NAME_REQUIRED]: 'Movement name cannot be empty.',
  [AppErrorCode.MOVEMENT_AMOUNT_INVALID]: 'Amount must be a positive whole number of cents.',
  [AppErrorCode.MOVEMENT_DATE_INVALID]: 'The movement date is invalid.',
  [AppErrorCode.MOVEMENT_CATEGORY_REQUIRED]: 'A valid category must be selected.',
  [AppErrorCode.MOVEMENT_ENVELOPE_REQUIRED]: 'A valid envelope must be selected.',
  [AppErrorCode.MOVEMENT_ID_INVALID]: 'One or more movement ids are invalid.',
  [AppErrorCode.CATEGORY_NAME_REQUIRED]: 'Category name cannot be empty.',
  [AppErrorCode.CATEGORY_DELETE_DEFAULT]: 'Cannot delete the default category.',
  [AppErrorCode.CATEGORY_NO_DEFAULT]: 'Set a default category before deleting any category.',
  [AppErrorCode.ACCOUNT_NAME_REQUIRED]: 'Account name cannot be empty.',
  [AppErrorCode.ACCOUNT_DELETE_DEFAULT]: 'Cannot delete the default account.',
  [AppErrorCode.ENVELOPE_NAME_REQUIRED]: 'Envelope name cannot be empty.',
  [AppErrorCode.ENVELOPE_ACCOUNT_REQUIRED]: 'An envelope must belong to an account.',
  [AppErrorCode.ENVELOPE_DELETE_DEFAULT]: 'Cannot delete the default envelope.',
  [AppErrorCode.ENVELOPE_NO_ACCOUNT]: 'Cannot delete an envelope with no account.',
  [AppErrorCode.ENVELOPE_ACCOUNT_NO_DEFAULT]:
    'Set a default envelope for this account before deleting.',
  [AppErrorCode.ENVELOPE_NOT_FOUND]: 'Envelope not found.',
  [AppErrorCode.ENVELOPE_ORPHAN_DEFAULT]: 'Cannot set default on an envelope with no account.',
  [AppErrorCode.TAG_TYPE_REQUIRED]: 'Tag type cannot be empty.',
  [AppErrorCode.TAG_NAME_REQUIRED]: 'Tag name cannot be empty.',
  [AppErrorCode.CONSTRAINT_VIOLATION]: 'This item already exists or violates a uniqueness rule.',
  [AppErrorCode.UNKNOWN]: 'Something went wrong.',
};

const FALLBACK = 'Something went wrong.';

@Injectable({ providedIn: 'root' })
export class ErrorTextService {
  resolve(code: string): string {
    return ERROR_MESSAGES[code] ?? FALLBACK;
  }
}
