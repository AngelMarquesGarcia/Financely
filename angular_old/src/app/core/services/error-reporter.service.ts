import { inject, Injectable } from '@angular/core';
import { catchError, EMPTY, OperatorFunction } from 'rxjs';
import { NotificationService } from './notification.service';
import { ErrorTextService } from './error-text.service';

/**
 * Pipes errors into the global toast layer and swallows them, so callers can
 * write `.pipe(errors.toast())` instead of repeating an `error:` block in every
 * subscription. Behavior on error: the stream completes (no further emissions),
 * matching the implicit contract of the `error: (e) => notify.error(...)` pattern.
 */
@Injectable({ providedIn: 'root' })
export class ErrorReporter {
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);

  toast<T>(): OperatorFunction<T, T> {
    return catchError((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.notify.error(this.errorText.resolve(message));
      return EMPTY;
    });
  }
}
