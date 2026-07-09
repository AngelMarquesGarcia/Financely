import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { DialogService } from '../../core/services/dialog.service';
import { FormsModule } from '@angular/forms';
import { CategoryT, CompoundMovementT, EnvelopeT, FilterSummaryT, MovementT, MovementFilter, TagT } from '@shared/types';
import { MovementFormComponent } from './movement-form/movement-form.component';
import { MovementsListComponent } from './movements-list/movements-list.component';
import { MovementListCompactComponent } from './movement-list-compact/movement-list-compact.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { FilterSummaryComponent } from '../../shared/components/filter-summary/filter-summary.component';
import { CompoundFormComponent, CompoundFormData } from '../compounds/compound-form/compound-form.component';

@Component({
  selector: 'app-movements',
  imports: [
    FormsModule,
    MovementFormComponent,
    MovementsListComponent,
    MovementListCompactComponent,
    ModalComponent,
    FilterSummaryComponent,
  ],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.scss',
})
export class MovementsComponent implements OnInit {
  private electron = inject(ElectronService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);
  private errors = inject(ErrorReporter);
  private refresh = inject(DataRefreshService);
  private dialog = inject(DialogService);
  private destroyRef = inject(DestroyRef);

  movements: MovementT[] = [];
  categories: CategoryT[] = [];
  envelopes: EnvelopeT[] = [];
  tags: TagT[] = [];
  movementTags: Record<number, TagT[]> = {};
  compounds: CompoundMovementT[] = [];
  editingMovement: MovementT | null = null;

  /** On-the-fly summary of the movements matching the active filter, over its month interval. */
  filterSummary: FilterSummaryT | null = null;
  /** Toggle for the summary card: include anomalous movements in the figures (default excludes them). */
  showSummaryAnomalies = false;

  private currentFilter: MovementFilter = {};

  /** Envelope the list is currently filtered to (drives split movements' partial display), or null. */
  get scopedEnvelopeId(): number | null {
    return this.currentFilter.envelopeId ?? null;
  }

  ngOnInit() {
    this.loadMovements();
    forkJoin({
      categories: this.electron.getAllCategories(),
      envelopes: this.electron.getAllEnvelopes(),
      tags: this.electron.getAllTags(),
    })
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, envelopes, tags }) => {
        this.categories = categories;
        this.envelopes = envelopes;
        this.tags = tags;
      });
  }

  loadMovements() {
    this.loadFilterSummary();
    this.loadCompounds();
    this.electron
      .getAllMovements(this.currentFilter)
      .pipe(
        switchMap((list) => {
          this.movements = list;
          if (list.length === 0) return of<Record<number, TagT[]>>({});
          return this.electron.getTagsForMovements(list.map((m) => m.id));
        }),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((tagMap) => (this.movementTags = tagMap));
  }

  /** Refreshes the filter-summary card for the current filter (kept in sync with the list). */
  private loadFilterSummary() {
    this.electron
      .getFilterSummary(this.currentFilter)
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((summary) => (this.filterSummary = summary));
  }

  /** Compounds drive the list's owner-month collapse + greyed non-owner rows. */
  private loadCompounds() {
    this.electron
      .getAllCompoundMovements()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((compounds) => (this.compounds = compounds));
  }

  /** Opens the compound in its form (edit/detail) from a list row; reloads on close. */
  onCompoundDetail(compound: CompoundMovementT) {
    this.dialog
      .open<CompoundFormComponent, CompoundFormData, void>(CompoundFormComponent, {
        data: { compound },
        maxWidth: 'min(40rem, 94vw)',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadMovements());
  }

  onFilterChanged(filter: MovementFilter) {
    this.currentFilter = filter;
    this.loadMovements();
  }

  onEditRequested(m: MovementT) {
    this.editingMovement = m;
  }

  onDeleteRequested(id: number) {
    const target = this.movements.find((m) => m.id === id);
    if (!target) return;
    this.confirm
      .confirm({
        title: 'Delete movement',
        message: `Delete movement "${target.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.deleteMovement(id) : of(null))),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result !== null) {
          this.notify.success(`Movement "${target.name}" deleted.`);
          this.loadMovements();
          this.refresh.notifyMovementsChanged();
        }
      });
  }

  onBulkDeleteRequested(ids: number[]) {
    if (ids.length === 0) return;
    const count = ids.length;
    this.confirm
      .confirm({
        title: 'Delete movements',
        message: `Delete ${count} movement${count === 1 ? '' : 's'}? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.deleteManyMovements(ids) : of(null))),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((deleted) => {
        if (deleted != null) {
          this.notify.success(`${deleted} movement${deleted === 1 ? '' : 's'} deleted.`);
          this.loadMovements();
          this.refresh.notifyMovementsChanged();
        }
      });
  }

  onConfirmRequested(id: number) {
    const target = this.movements.find((m) => m.id === id);
    this.electron
      .confirmMovement(id)
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => {
        if (ok) {
          this.notify.success(`Movement "${target?.name ?? ''}" confirmed.`);
          this.loadMovements();
          this.refresh.notifyMovementsChanged();
        }
      });
  }

  onSaved() {
    this.editingMovement = null;
    this.loadMovements();
    this.refresh.notifyMovementsChanged();
  }

  onCancelled() {
    this.editingMovement = null;
  }

  /** Exports the movements matching the active filter (month / category / text / …) to CSV. */
  exportCurrentView() {
    this.electron
      .exportMovements(this.currentFilter)
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((path) => {
        if (path) this.notify.success(`Exported to ${path}`);
      });
  }
}
