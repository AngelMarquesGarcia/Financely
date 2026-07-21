import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { CompoundMovementT, MovementT } from '@shared/types';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { NotificationService } from '../../core/services/notification.service';
import { DialogService } from '../../core/services/dialog.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { CompoundsListComponent } from './compounds-list/compounds-list.component';
import { CompoundFormComponent, CompoundFormData } from './compound-form/compound-form.component';
import {
  CompoundDeleteDialogComponent,
  CompoundDeleteData,
  CompoundDeleteResult,
} from './compound-delete-dialog/compound-delete-dialog.component';

@Component({
  selector: 'app-compounds',
  imports: [CompoundsListComponent],
  templateUrl: './compounds.component.html',
  styleUrl: './compounds.component.scss',
})
export class CompoundsComponent implements OnInit {
  private electron = inject(ElectronService);
  private errors = inject(ErrorReporter);
  private notify = inject(NotificationService);
  private dialog = inject(DialogService);
  private refresh = inject(DataRefreshService);
  private destroyRef = inject(DestroyRef);

  compounds: CompoundMovementT[] = [];
  childCounts: Record<number, number> = {};

  ngOnInit(): void {
    this.reload();
    // Deleting a member movement elsewhere can dissolve a compound — keep the list fresh.
    this.refresh.movementsChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());
  }

  reload(): void {
    forkJoin({
      compounds: this.electron.getAllCompoundMovements(),
      movements: this.electron.getAllMovements(),
    })
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ compounds, movements }) => {
        this.compounds = compounds;
        this.childCounts = this.countChildren(movements);
      });
  }

  private countChildren(movements: MovementT[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const m of movements) {
      if (m.parentId != null) counts[m.parentId] = (counts[m.parentId] ?? 0) + 1;
    }
    return counts;
  }

  openCreate(): void {
    this.openForm(null);
  }

  openEdit(compound: CompoundMovementT): void {
    this.openForm(compound);
  }

  /** The form lives in a CDK dialog (not `<app-modal>`) so it nests correctly with the "New movement"
   *  dialog it can open, and carries the shared dialog card/backdrop. */
  private openForm(compound: CompoundMovementT | null): void {
    this.dialog
      .open<CompoundFormComponent, CompoundFormData | null, void>(CompoundFormComponent, {
        data: compound ? { compound } : null,
        maxWidth: 'min(40rem, 94vw)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());
  }

  onDeleteRequested(compound: CompoundMovementT): void {
    this.dialog
      .open<CompoundDeleteDialogComponent, CompoundDeleteData, CompoundDeleteResult>(
        CompoundDeleteDialogComponent,
        { data: { name: compound.name, childCount: this.childCounts[compound.id] ?? 0 } },
      )
      .afterClosed()
      .pipe(
        switchMap((result) =>
          result
            ? this.electron.deleteCompoundMovement(compound.id, result.deleteChildren)
            : of(null),
        ),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((deleted) => {
        if (deleted !== null) {
          this.notify.success(`Compound "${compound.name}" deleted.`);
          this.reload();
          this.refresh.notifyMovementsChanged();
        }
      });
  }
}
