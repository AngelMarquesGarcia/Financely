import { describe, it, expect } from 'vitest';
import { ErrorTextService } from './error-text.service';
import { AppErrorCode } from '@shared/error-codes';

describe('ErrorTextService', () => {
  const service = new ErrorTextService();

  it('resolves every AppErrorCode to a non-empty string', () => {
    for (const code of Object.values(AppErrorCode)) {
      const text = service.resolve(code);
      expect(text.length, `code ${code} should have a message`).toBeGreaterThan(0);
    }
  });

  it('returns fallback for unknown code', () => {
    expect(service.resolve('TOTALLY_UNKNOWN_CODE')).toBe('Something went wrong.');
  });

  it('recovers the code from an Electron-wrapped IPC rejection message', () => {
    const wrapped =
      "Error invoking remote method 'movement:create': Error: MOVEMENT_PREVIOUS_MONTH_TENTATIVE";
    expect(service.resolve(wrapped)).toBe(service.resolve(AppErrorCode.MOVEMENT_PREVIOUS_MONTH_TENTATIVE));
    expect(service.resolve(wrapped)).not.toBe('Something went wrong.');
  });
});
