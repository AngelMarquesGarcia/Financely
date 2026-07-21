import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Lightweight cross-view signal: something about movements changed (created / edited / deleted),
 * so balance & summary views that may be mounted on another route (e.g. the Envelopes page, reached
 * without navigating because of the global quick-create button) can reload. Fired by the movement
 * mutation flows; consumed by pages that display derived balances.
 */
@Injectable({ providedIn: 'root' })
export class DataRefreshService {
  private readonly _movementsChanged = new Subject<void>();
  readonly movementsChanged$: Observable<void> = this._movementsChanged.asObservable();

  notifyMovementsChanged(): void {
    this._movementsChanged.next();
  }
}
