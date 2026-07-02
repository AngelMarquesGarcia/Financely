import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { CategoryT, EnvelopeT, MovementT, MovementFilter, TagT } from '@shared/types';
import { MovementFormComponent } from './movement-form/movement-form.component';
import { MovementsListComponent } from './movements-list/movements-list.component';
import { MovementListCompactComponent } from './movement-list-compact/movement-list-compact.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';

@Component({
  selector: 'app-movements',
  imports: [MovementFormComponent, MovementsListComponent, MovementListCompactComponent, ModalComponent],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.scss',
})
export class MovementsComponent implements OnInit {
  private electron = inject(ElectronService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);
  private errors = inject(ErrorReporter);
  private destroyRef = inject(DestroyRef);

  movements: MovementT[] = [];
  categories: CategoryT[] = [];
  envelopes: EnvelopeT[] = [];
  tags: TagT[] = [];
  movementTags: Record<number, TagT[]> = {};
  editingMovement: MovementT | null = null;

  private currentFilter: MovementFilter = {};

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
        }
      });
  }

  onSaved() {
    this.editingMovement = null;
    this.loadMovements();
  }

  onCancelled() {
    this.editingMovement = null;
  }
}
