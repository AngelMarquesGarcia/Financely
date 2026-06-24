import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SortEvent } from '../../shared/directives/sortable.directive';
import { IconPickerComponent } from '../../shared/components/icon-picker/icon-picker.component';
import { ColorSwatchesComponent } from '../../shared/components/color-swatches/color-swatches.component';
import { ElectronService } from '../../core/services/electron.service';
import { NotificationService } from '../../core/services/notification.service';
import { ErrorTextService } from '../../core/services/error-text.service';
import { DialogRef } from '../../core/services/dialog-ref';
import { DEFAULT_COLOR_ORDER, DEFAULT_CATEGORY_ICONS } from '@shared/defaults';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, IconPickerComponent, ColorSwatchesComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private electron = inject(ElectronService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private destroyRef = inject(DestroyRef);
  protected readonly dialogRef = inject(DialogRef, { optional: true });

  useDefaultDate = false;
  defaultDate = '';
  colorOrder: string[] = [];
  categoryIcons: string[] = [];

  ngOnInit() {
    this.defaultDate = new Date().toISOString().substring(0, 10);
    this.electron
      .getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.useDefaultDate = s.useDefaultDate;
          this.defaultDate = s.defaultDate || new Date().toISOString().substring(0, 10);
          this.colorOrder = s.colorOrder?.length ? [...s.colorOrder] : [...DEFAULT_COLOR_ORDER];
          this.categoryIcons = s.categoryIcons?.length ? [...s.categoryIcons] : [...DEFAULT_CATEGORY_ICONS];
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  onUseDefaultDateChange(value: boolean) {
    this.useDefaultDate = value;
    this.saveDateSettings();
  }

  onDefaultDateChange(value: string) {
    this.defaultDate = value;
    this.saveDateSettings();
  }

  onColorAdded(value: string) {
    if (this.colorOrder.includes(value)) return;
    this.colorOrder = [...this.colorOrder, value];
    this.saveColors();
  }

  onColorReorder({ oldIndex, newIndex }: SortEvent) {
    const copy = [...this.colorOrder];
    const [moved] = copy.splice(oldIndex, 1);
    copy.splice(newIndex, 0, moved);
    this.colorOrder = copy;
    this.saveColors();
  }

  onColorDeleteRequested(toDelete: string[]) {
    const deleteSet = new Set(toDelete);
    this.colorOrder = this.colorOrder.filter((c) => !deleteSet.has(c));
    this.saveColors();
  }

  resetColors() {
    this.colorOrder = [...DEFAULT_COLOR_ORDER];
    this.saveColors();
  }

  onIconAdded(icon: string) {
    this.categoryIcons = [...this.categoryIcons, icon];
    this.saveIcons();
  }

  onDeleteRequested(toDelete: string[]) {
    const deleteSet = new Set(toDelete);
    this.categoryIcons = this.categoryIcons.filter((icon) => !deleteSet.has(icon));
    this.saveIcons();
  }

  onIconReorder({ oldIndex, newIndex }: SortEvent) {
    const copy = [...this.categoryIcons];
    const [moved] = copy.splice(oldIndex, 1);
    copy.splice(newIndex, 0, moved);
    this.categoryIcons = copy;
    this.saveIcons();
  }

  resetIcons() {
    this.categoryIcons = [...DEFAULT_CATEGORY_ICONS];
    this.saveIcons();
  }

  private saveDateSettings() {
    this.electron
      .saveSettings({ useDefaultDate: this.useDefaultDate, defaultDate: this.defaultDate })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  private saveColors() {
    this.electron
      .saveSettings({ colorOrder: [...this.colorOrder] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  private saveIcons() {
    this.electron
      .saveSettings({ categoryIcons: [...this.categoryIcons] })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }
}
