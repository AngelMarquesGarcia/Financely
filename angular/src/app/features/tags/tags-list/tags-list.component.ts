import { Component, DestroyRef, EventEmitter, inject, Input, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { ConfirmService } from '../../../core/services/confirm.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ElectronService } from '../../../core/services/electron.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { TagT } from '@shared/types';
import { TagFormComponent } from '../tag-form/tag-form.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-tags-list',
  imports: [FaIconComponent, TagFormComponent, EmptyStateComponent],
  templateUrl: './tags-list.component.html',
  styleUrl: './tags-list.component.scss',
})
export class TagsListComponent {
  protected readonly faPlus = faPlus;
  @Input() tags: TagT[] = [];
  @Output() changed = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private destroyRef = inject(DestroyRef);

  showForm = false;
  editingTag: TagT | null = null;

  get existingTypes(): string[] {
    return [...new Set(this.tags.map((t) => t.type))].sort();
  }

  openCreate() {
    this.editingTag = null;
    this.showForm = true;
  }

  openEdit(tag: TagT) {
    this.editingTag = tag;
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.editingTag = null;
  }

  onSaved() {
    this.closeForm();
    this.changed.emit();
  }

  deleteTag(id: number) {
    const target = this.tags.find((t) => t.id === id);
    if (!target) return;
    this.confirm
      .confirm({
        title: 'Delete tag',
        message: `Delete tag "${target.name}"? It will be removed from all movements that have it.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.deleteTag(id) : of(null))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (result !== null) {
            this.notify.success(`Tag "${target.name}" deleted.`);
            this.changed.emit();
          }
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }
}
