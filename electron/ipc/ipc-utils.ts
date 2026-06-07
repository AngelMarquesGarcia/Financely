import { AppError, AppErrorCode } from '@shared/error-codes';

/**
 * Wraps an IPC handler so that thrown errors always resolve to a known AppErrorCode.
 * AppError passes through as-is (message === code). Native better-sqlite3 constraint
 * errors map to CONSTRAINT_VIOLATION; everything else maps to UNKNOWN.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ipcHandle<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
  return (...args) => {
    try {
      return fn(...args);
    } catch (e: unknown) {
      if (e instanceof AppError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/UNIQUE|SQLITE_CONSTRAINT/i.test(msg)) {
        throw new AppError(AppErrorCode.CONSTRAINT_VIOLATION);
      }
      throw new AppError(AppErrorCode.UNKNOWN);
    }
  };
}
