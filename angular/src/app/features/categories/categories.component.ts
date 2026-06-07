import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { Category } from '@shared/types';
import { CategoryFormComponent } from './category-form/category-form.component';
import { CategoriesListComponent } from './categories-list/categories-list.component';

@Component({
  selector: 'app-categories',
  imports: [CategoryFormComponent, CategoriesListComponent],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent implements OnInit {
  private electron = inject(ElectronService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);
  private errors = inject(ErrorReporter);
  private destroyRef = inject(DestroyRef);

  categories: Category[] = [];
  editingCategory: Category | null = null;

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.electron
      .getAllCategories()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => (this.categories = list));
  }

  onEditRequested(c: Category) {
    this.editingCategory = c;
  }

  onDeleteRequested(id: number) {
    const target = this.categories.find((c) => c.id === id);
    if (!target) return;
    this.confirm
      .confirm({
        title: 'Delete category',
        message: `Delete category "${target.name}"? Its movements will be reassigned to the default category.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.deleteCategory(id) : of(null))),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result !== null) {
          this.notify.success(`Category "${target.name}" deleted.`);
          this.loadAll();
        }
      });
  }

  onSetDefaultRequested(id: number) {
    this.electron
      .setDefaultCategory(id)
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadAll());
  }

  onSaved() {
    this.editingCategory = null;
    this.loadAll();
  }

  onCancelled() {
    this.editingCategory = null;
  }
}
