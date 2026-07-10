import { Injectable } from '@angular/core';
import { AppErrorCode } from '@shared/error-codes';

const ERROR_MESSAGES: Record<string, string> = {
  [AppErrorCode.MOVEMENT_NAME_REQUIRED]: 'Movement name cannot be empty.',
  [AppErrorCode.MOVEMENT_AMOUNT_INVALID]: 'Amount must be a positive whole number of cents.',
  [AppErrorCode.MOVEMENT_DATE_INVALID]: 'The movement date is invalid.',
  [AppErrorCode.MOVEMENT_CATEGORY_REQUIRED]: 'A valid category must be selected.',
  [AppErrorCode.MOVEMENT_ENVELOPE_REQUIRED]: 'A valid envelope must be selected.',
  [AppErrorCode.MOVEMENT_ID_INVALID]: 'One or more movement ids are invalid.',
  [AppErrorCode.MOVEMENT_PREVIOUS_MONTH_TENTATIVE]:
    'A previous month still has movements awaiting review. Confirm or cancel those first.',
  [AppErrorCode.MOVEMENT_NOT_TENTATIVE]: 'This movement is not awaiting review.',
  [AppErrorCode.MOVEMENT_SPLIT_SUM_MISMATCH]:
    'The amounts assigned to each envelope must add up to the movement total.',
  [AppErrorCode.MOVEMENT_SPLIT_AMOUNT_INVALID]:
    'Each envelope share must be a positive whole number of cents.',
  [AppErrorCode.MOVEMENT_SPLIT_ENVELOPE_INVALID]: 'A split references an invalid envelope.',
  [AppErrorCode.PERIODIC_NAME_REQUIRED]: 'Periodic movement name cannot be empty.',
  [AppErrorCode.PERIODIC_NAME_DUPLICATE]: 'A periodic movement with this name already exists.',
  [AppErrorCode.PERIODIC_AMOUNT_INVALID]: 'Amount must be a positive whole number of cents.',
  [AppErrorCode.PERIODIC_DAY_INVALID]: 'Day of month must be between 1 and 31.',
  [AppErrorCode.PERIODIC_ACCOUNT_REQUIRED]: 'A valid account must be selected.',
  [AppErrorCode.PERIODIC_CATEGORY_REQUIRED]: 'A valid category must be selected.',
  [AppErrorCode.PERIODIC_ENVELOPE_REQUIRED]: 'A valid envelope must be selected.',
  [AppErrorCode.PERIODIC_NOT_FOUND]: 'Periodic movement not found.',
  [AppErrorCode.PERIODIC_DELETE_HAS_INSTANCES]:
    'This template already generated movements. Deactivate it instead of deleting.',
  [AppErrorCode.PERIODIC_DATE_FUTURE]: 'The date cannot be in the future.',
  [AppErrorCode.PERIODIC_ALREADY_INSTANTIATED]: "This month's instance was already created.",
  [AppErrorCode.CATEGORY_NAME_REQUIRED]: 'Category name cannot be empty.',
  [AppErrorCode.CATEGORY_DELETE_DEFAULT]: 'Cannot delete the default category.',
  [AppErrorCode.CATEGORY_NO_DEFAULT]: 'Set a default category before deleting any category.',
  [AppErrorCode.ACCOUNT_NAME_REQUIRED]: 'Account name cannot be empty.',
  [AppErrorCode.ACCOUNT_DELETE_DEFAULT]: 'Cannot delete the default account.',
  [AppErrorCode.ENVELOPE_NAME_REQUIRED]: 'Envelope name cannot be empty.',
  [AppErrorCode.ENVELOPE_ACCOUNT_REQUIRED]: 'An envelope must belong to an account.',
  [AppErrorCode.ENVELOPE_UPDATE_DEFAULT]:
    'Use the "Set as default" action to change the default envelope.',
  [AppErrorCode.ENVELOPE_DELETE_DEFAULT]: 'Cannot delete the default envelope.',
  [AppErrorCode.ENVELOPE_NO_ACCOUNT]: 'Cannot delete an envelope with no account.',
  [AppErrorCode.ENVELOPE_ACCOUNT_NO_DEFAULT]:
    'Set a default envelope for this account before deleting.',
  [AppErrorCode.ENVELOPE_NOT_FOUND]: 'Envelope not found.',
  [AppErrorCode.ENVELOPE_BUDGET_NEGATIVE]: 'Budget cannot be negative.',
  [AppErrorCode.ENVELOPE_MAXSAVINGS_NEGATIVE]: 'Max savings cannot be negative.',
  [AppErrorCode.ENVELOPE_OVERFLOWS_TO_SELF]: 'An envelope cannot overflow into itself.',
  [AppErrorCode.ENVELOPE_ORPHAN_DEFAULT]: 'Cannot set default on an envelope with no account.',
  [AppErrorCode.TRANSFER_SAME_ENVELOPE]: 'A transfer must be between two different envelopes.',
  [AppErrorCode.TRANSFER_AMOUNT_INVALID]:
    'Transfer amount must be a positive whole number of cents.',
  [AppErrorCode.TRANSFER_CROSS_ACCOUNT]:
    'Transfers are only allowed between envelopes of the same account.',
  [AppErrorCode.TRANSFER_DATE_INVALID]: 'The transfer date is invalid.',
  [AppErrorCode.TRANSFER_NOT_FOUND]: 'Transfer not found.',
  [AppErrorCode.TAG_TYPE_REQUIRED]: 'Tag type cannot be empty.',
  [AppErrorCode.TAG_NAME_REQUIRED]: 'Tag name cannot be empty.',
  [AppErrorCode.COMPOUND_NAME_REQUIRED]: 'Compound name cannot be empty.',
  [AppErrorCode.COMPOUND_NOT_FOUND]: 'Compound movement not found.',
  [AppErrorCode.COMPOUND_TOO_FEW_CHILDREN]: 'A compound needs at least two movements.',
  [AppErrorCode.COMPOUND_CROSS_ACCOUNT]:
    'All movements in a compound must belong to the same account.',
  [AppErrorCode.COMPOUND_CHILD_SPLIT]: 'A split movement cannot be part of a compound.',
  [AppErrorCode.COMPOUND_CHILD_PERIODIC]:
    'A generated periodic movement cannot be part of a compound.',
  [AppErrorCode.COMPOUND_CHILD_TENTATIVE]:
    'A movement awaiting review cannot be part of a compound.',
  [AppErrorCode.COMPOUND_CHILD_ALREADY_PARENTED]:
    'That movement already belongs to another compound.',
  [AppErrorCode.COMPOUND_CHILD_NOT_MEMBER]: 'That movement is not a member of this compound.',
  [AppErrorCode.COMPOUND_CANCELABLE_MULTI_ENVELOPE]:
    'A cancelable compound requires all its movements to share one envelope.',
  [AppErrorCode.COMPOUND_OWNER_MONTH_INVALID]:
    'The owner month must be one of the months its movements fall in.',
  [AppErrorCode.COMPOUND_ANOMALY_CHILD_CONFLICT]:
    'A movement cannot be marked non-anomalous while its compound is anomalous.',
  [AppErrorCode.EXPORT_CONTAINS_TENTATIVE]:
    'This selection has movements awaiting review — confirm or cancel them before exporting.',
  [AppErrorCode.IMPORT_ACCOUNT_HAS_TENTATIVE]:
    'The target account has movements awaiting review — confirm or cancel them before importing.',
  [AppErrorCode.IMPORT_MISSING_COLUMNS]:
    'The CSV must have at least concept, quantity and date columns.',
  [AppErrorCode.BACKUP_FAILED]: 'The database backup could not be completed.',
  [AppErrorCode.RESTORE_INVALID_FILE]: "That file isn't a valid Financely backup.",
  [AppErrorCode.CONSTRAINT_VIOLATION]: 'This item already exists or violates a uniqueness rule.',
  [AppErrorCode.UNKNOWN]: 'Something went wrong.',
};

const FALLBACK = 'Something went wrong.';

@Injectable({ providedIn: 'root' })
export class ErrorTextService {
  /**
   * Maps an error to a human-readable message. Accepts a bare `AppErrorCode` (the `ipcHandle`
   * contract) or a wrapped message — Electron rejects IPC calls with e.g.
   * `"Error invoking remote method 'movement:create': Error: MOVEMENT_PREVIOUS_MONTH_TENTATIVE"`,
   * so we also recover the code from any UPPER_SNAKE_CASE token in the string (trailing wins).
   */
  resolve(codeOrMessage: string): string {
    const direct = ERROR_MESSAGES[codeOrMessage];
    if (direct) return direct;
    const token = codeOrMessage
      .match(/[A-Z][A-Z0-9_]{2,}/g)
      ?.reverse()
      .find((t) => t in ERROR_MESSAGES);
    return token ? ERROR_MESSAGES[token] : FALLBACK;
  }
}
