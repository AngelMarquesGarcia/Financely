import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { SortEvent } from '../../../shared/directives/sortable.directive';
import { IconPickerComponent } from '../../../shared/components/icon-picker/icon-picker.component';
import { ColorSwatchesComponent } from '../../../shared/components/color-swatches/color-swatches.component';
import { ElectronService } from '../../../core/services/electron.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { CategoryT } from '@shared/types';
import { DEFAULT_COLOR_ORDER, DEFAULT_CATEGORY_ICONS } from '@shared/defaults';
import { contrastColor } from '../../../shared/utils';

@Component({
  selector: 'app-category-form',
  imports: [FormsModule, IconPickerComponent, ColorSwatchesComponent],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss',
})
export class CategoryFormComponent implements OnInit, OnChanges {
  @Input() editingCategory: CategoryT | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private destroyRef = inject(DestroyRef);

  presetColors: string[] = [...DEFAULT_COLOR_ORDER];
  availableIcons: string[] = [...DEFAULT_CATEGORY_ICONS];

  name = '';
  color = DEFAULT_COLOR_ORDER[5];
  emoji = '';
  showErrors = false;

  get isEditing() {
    return this.editingCategory !== null;
  }

  get previewTextColor(): string {
    return contrastColor(this.color);
  }

  ngOnInit() {
    this.electron
      .getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          if (s.colorOrder.length > 0) {
            this.presetColors = [...s.colorOrder];
            if (!this.editingCategory) {
              this.color = this.presetColors[5] ?? this.presetColors[0];
            }
          }
          this.availableIcons = s.categoryIcons?.length
            ? [...s.categoryIcons]
            : [...DEFAULT_CATEGORY_ICONS];
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['editingCategory']) {
      const c = this.editingCategory;
      this.name = c ? c.name : '';
      this.color = c?.color ?? this.presetColors[5];
      this.emoji = c ? (c.emoji ?? '') : '';
    }
  }

  onColorAdded(value: string) {
    if (this.presetColors.includes(value)) return;
    this.presetColors = [...this.presetColors, value];
    this.color = value;
    this.persistSettings({ colorOrder: [...this.presetColors] });
  }

  onIconAdded(icon: string) {
    this.availableIcons = [...this.availableIcons, icon];
    this.emoji = icon;
    this.persistSettings({ categoryIcons: [...this.availableIcons] });
  }

  onIconReorder({ oldIndex, newIndex }: SortEvent) {
    const copy = [...this.availableIcons];
    const [moved] = copy.splice(oldIndex, 1);
    copy.splice(newIndex, 0, moved);
    this.availableIcons = copy;
    this.persistSettings({ categoryIcons: copy });
  }

  onColorReorder({ oldIndex, newIndex }: SortEvent) {
    const copy = [...this.presetColors];
    const [moved] = copy.splice(oldIndex, 1);
    copy.splice(newIndex, 0, moved);
    this.presetColors = copy;
    this.persistSettings({ colorOrder: copy });
  }

  private persistSettings(patch: Parameters<ElectronService['saveSettings']>[0]) {
    this.electron
      .saveSettings(patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  save() {
    this.showErrors = true;
    if (!this.name.trim()) return;
    if (this.isEditing) {
      this.electron
        .updateCategory({
          id: this.editingCategory!.id,
          name: this.name,
          color: this.color,
          emoji: this.emoji || undefined,
          envelopeId: this.editingCategory!.envelopeId,
          isDefault: this.editingCategory!.isDefault,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.saved.emit(),
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    } else {
      this.electron
        .createCategory(this.name, this.color, this.emoji || undefined)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saved.emit();
            this.name = '';
            this.color = this.presetColors[5] ?? this.presetColors[0];
            this.emoji = '';
            this.showErrors = false;
          },
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    }
  }

  cancel() {
    this.cancelled.emit();
  }
}
