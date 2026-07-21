import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Subject } from 'rxjs';
import { DialogRef } from './dialog-ref';
import type { OverlayRef } from '@angular/cdk/overlay';

function mockOverlayRef() {
  const backdrop$ = new Subject<MouseEvent>();
  const keydown$ = new Subject<KeyboardEvent>();
  const dispose = vi.fn();
  const ref = {
    backdropClick: () => backdrop$.asObservable(),
    keydownEvents: () => keydown$.asObservable(),
    dispose,
  } as unknown as OverlayRef;
  return { ref, backdrop$, keydown$, dispose };
}

describe('DialogRef', () => {
  let mock: ReturnType<typeof mockOverlayRef>;
  let dialogRef: DialogRef<string>;
  let closedWith: string | undefined | null;
  let afterClosedFired: boolean;

  beforeEach(() => {
    mock = mockOverlayRef();
    dialogRef = new DialogRef<string>(mock.ref);
    closedWith = null;
    afterClosedFired = false;
    dialogRef.afterClosed().subscribe((v) => {
      afterClosedFired = true;
      closedWith = v;
    });
  });

  it('closes on backdrop click', () => {
    mock.backdrop$.next(new MouseEvent('click'));
    expect(afterClosedFired).toBe(true);
    expect(mock.dispose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    mock.keydown$.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(afterClosedFired).toBe(true);
  });

  it('ignores non-Escape keys', () => {
    mock.keydown$.next(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(afterClosedFired).toBe(false);
    expect(mock.dispose).not.toHaveBeenCalled();
  });

  it('forwards close() result to afterClosed()', () => {
    dialogRef.close('hello');
    expect(closedWith).toBe('hello');
    expect(mock.dispose).toHaveBeenCalled();
  });
});
