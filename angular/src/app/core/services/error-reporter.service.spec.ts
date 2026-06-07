import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ErrorReporter } from './error-reporter.service';
import { NotificationService } from './notification.service';
import { ErrorTextService } from './error-text.service';

function setup() {
  const notify = { error: vi.fn(), success: vi.fn(), info: vi.fn(), dismiss: vi.fn() };
  const errorText = { resolve: vi.fn((code: string) => `resolved:${code}`) };

  TestBed.configureTestingModule({
    providers: [
      ErrorReporter,
      { provide: NotificationService, useValue: notify },
      { provide: ErrorTextService, useValue: errorText },
    ],
  });
  return { reporter: TestBed.inject(ErrorReporter), notify, errorText };
}

describe('ErrorReporter', () => {
  it('passes through values when no error', () => {
    const { reporter, notify } = setup();
    let received: number | null = null;
    of(42)
      .pipe(reporter.toast())
      .subscribe((v) => (received = v));
    expect(received).toBe(42);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('routes an Error through the resolver to notify.error and swallows it', () => {
    const { reporter, notify, errorText } = setup();
    let emitted = false;
    let completed = false;
    throwError(() => new Error('SOME_CODE'))
      .pipe(reporter.toast())
      .subscribe({
        next: () => (emitted = true),
        complete: () => (completed = true),
      });
    expect(emitted).toBe(false);
    expect(completed).toBe(true);
    expect(errorText.resolve).toHaveBeenCalledWith('SOME_CODE');
    expect(notify.error).toHaveBeenCalledWith('resolved:SOME_CODE');
  });
});
