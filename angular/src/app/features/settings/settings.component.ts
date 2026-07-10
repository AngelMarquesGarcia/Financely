import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SortEvent } from '../../shared/directives/sortable.directive';
import { IconPickerComponent } from '../../shared/components/icon-picker/icon-picker.component';
import { ColorSwatchesComponent } from '../../shared/components/color-swatches/color-swatches.component';
import { ElectronService } from '../../core/services/electron.service';
import { NotificationService } from '../../core/services/notification.service';
import { ErrorTextService } from '../../core/services/error-text.service';
import { DialogRef } from '../../core/services/dialog-ref';
import { DEFAULT_COLOR_ORDER, DEFAULT_CATEGORY_ICONS } from '@shared/defaults';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { DialogService } from '../../core/services/dialog.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { DataRefreshService } from '../../core/services/data-refresh.service';
import { AccountT } from '@shared/types';
import {
  ImportPreviewDialogComponent,
  ImportPreviewData,
} from '../import-export/import-preview-dialog/import-preview-dialog.component';

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
  private confirm = inject(ConfirmService);
  private errors = inject(ErrorReporter);
  private dialog = inject(DialogService);
  private refresh = inject(DataRefreshService);
  private router = inject(Router);

  useDefaultDate = false;
  defaultDate = '';
  colorOrder: string[] = [];
  categoryIcons: string[] = [];

  protected accounts: AccountT[] = [];
  protected selectedAccountId: number | null = null;

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
          this.categoryIcons = s.categoryIcons?.length
            ? [...s.categoryIcons]
            : [...DEFAULT_CATEGORY_ICONS];
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });

    this.electron
      .getAllAccounts()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((accounts) => {
        this.accounts = accounts;
        this.selectedAccountId = accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? null;
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

  // --- Data management ---------------------------------------------------------------------------

  /** Opens the OS file picker, previews the CSV, and — if confirmed — imports into the chosen account. */
  onImport() {
    const accountId = this.selectedAccountId;
    if (accountId == null) return;
    const accountName = this.accounts.find((a) => a.id === accountId)?.name ?? '';

    this.electron
      .previewImport(accountId)
      .pipe(
        switchMap((result) => {
          if (!result) return of(null); // picker cancelled
          return this.dialog
            .open<ImportPreviewDialogComponent, ImportPreviewData, boolean>(
              ImportPreviewDialogComponent,
              { data: { result, accountName }, maxWidth: 'min(60rem, 96vw)' },
            )
            .afterClosed()
            .pipe(
              switchMap((ok) =>
                ok ? this.electron.commitImport(result.drafts, accountId) : of(null),
              ),
            );
        }),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((count) => {
        if (count != null) {
          this.notify.success(`Imported ${count} movement${count === 1 ? '' : 's'}.`);
          this.refresh.notifyMovementsChanged();
        }
      });
  }

  onExportAll() {
    this.electron
      .exportMovements()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((path) => {
        if (path) this.notify.success(`Exported to ${path}`);
      });
  }

  onBackup() {
    this.electron
      .backupDatabase()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((path) => {
        if (path) this.notify.success(`Backup saved to ${path}`);
      });
  }

  onRestore() {
    this.confirm
      .confirm({
        title: 'Restore backup',
        message: 'This replaces ALL current data with the backup and cannot be undone.',
        confirmLabel: 'Restore',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.restoreDatabase() : of(false))),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((done) => {
        if (done) {
          this.notify.success('Database restored.');
          this.reloadApp();
        }
      });
  }

  onWipeData() {
    this.confirm
      .confirm({
        title: 'Delete all data',
        message: 'This permanently deletes ALL data and cannot be undone.',
        confirmLabel: 'Delete everything',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.dropAllTables() : of(null))),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result !== null) {
          this.notify.success('All data deleted.');
          this.reloadApp();
        }
      });
  }

  onSeedData() {
    this.electron
      .seedExampleData()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.notify.success('Example data seeded.');
        this.reloadApp();
      });
  }

  /**
   * Whole-DB operations (restore / wipe / seed) replace every entity, so the current view must reload
   * from scratch. A hard `window.location.reload()` can't be used: the packaged app runs from a
   * `file://…/index.html` with a relative `<base href>`, so reloading the current route path 404s to a
   * blank page. Navigate client-side to the movements view instead — this re-creates the component,
   * which re-fetches the now-fresh database. Closes the settings dialog first when open.
   */
  private reloadApp() {
    this.dialogRef?.close();
    this.router.navigateByUrl('/movements');
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
