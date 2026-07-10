import { OverlayRef } from '@angular/cdk/overlay';
import { Observable, Subject, takeUntil } from 'rxjs';

export class DialogRef<R = unknown> {
  private readonly _afterClosed = new Subject<R | undefined>();

  constructor(private readonly overlayRef: OverlayRef) {
    overlayRef
      .backdropClick()
      .pipe(takeUntil(this._afterClosed))
      .subscribe(() => this.close());
    overlayRef
      .keydownEvents()
      .pipe(takeUntil(this._afterClosed))
      .subscribe((e) => {
        if (e.key === 'Escape') this.close();
      });
  }

  close(result?: R): void {
    this._afterClosed.next(result);
    this._afterClosed.complete();
    this.overlayRef.dispose();
  }

  afterClosed(): Observable<R | undefined> {
    return this._afterClosed.asObservable();
  }
}
