import {
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { TagT } from '@shared/types';

const COLOR_OPTIONS = [
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Slate', value: '#64748b' },
  { label: 'Dark', value: '#0f172a' },
];

@Component({
  selector: 'app-tag-form',
  imports: [FormsModule],
  templateUrl: './tag-form.component.html',
  styleUrl: './tag-form.component.scss',
})
export class TagFormComponent implements OnChanges {
  @Input() editingTag: TagT | null = null;
  @Input() existingTypes: string[] = [];
  @Output() saved = new EventEmitter<number | null>();
  @Output() cancelled = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private destroyRef = inject(DestroyRef);

  readonly colorOptions = COLOR_OPTIONS;

  type = '';
  name = '';
  color = COLOR_OPTIONS[5].value;
  colorOpen = false;

  get isEditing() {
    return this.editingTag !== null;
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.colorOpen = false;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['editingTag']) {
      const t = this.editingTag;
      this.type = t?.type ?? '';
      this.name = t?.name ?? '';
      this.color = t?.color ?? COLOR_OPTIONS[5].value;
      this.colorOpen = false;
    }
  }

  toggleColorDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.colorOpen = !this.colorOpen;
  }

  selectColor(value: string) {
    this.color = value;
    this.colorOpen = false;
  }

  save() {
    if (!this.type.trim() || !this.name.trim()) return;

    if (this.isEditing) {
      this.electron
        .updateTag({ id: this.editingTag!.id, type: this.type, name: this.name, color: this.color })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.saved.emit(null),
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    } else {
      this.electron
        .createTag(this.type, this.name, this.color)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (newId) => {
            this.saved.emit(Number(newId));
            this.type = '';
            this.name = '';
            this.color = COLOR_OPTIONS[5].value;
          },
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    }
  }

  cancel() {
    this.cancelled.emit();
  }
}
