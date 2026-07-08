import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CompoundMovementT } from '@shared/types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

/** Presentational table of compound movements. The container owns the data and the create/edit flow. */
@Component({
  selector: 'app-compounds-list',
  imports: [EmptyStateComponent],
  templateUrl: './compounds-list.component.html',
  styleUrl: './compounds-list.component.scss',
})
export class CompoundsListComponent {
  @Input() compounds: CompoundMovementT[] = [];
  /** Member count per compound id (derived by the container from the movement list). */
  @Input() childCounts: Record<number, number> = {};
  @Output() editRequested = new EventEmitter<CompoundMovementT>();
  @Output() deleteRequested = new EventEmitter<CompoundMovementT>();

  childCount(c: CompoundMovementT): number {
    return this.childCounts[c.id] ?? 0;
  }

  /** "April 2026", or "Yearly" when the compound has no owner month (spec §6 null-owner). */
  ownerLabel(c: CompoundMovementT): string {
    if (c.ownerYear == null || c.ownerMonth == null) return 'Yearly';
    return new Date(c.ownerYear, c.ownerMonth, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }
}
