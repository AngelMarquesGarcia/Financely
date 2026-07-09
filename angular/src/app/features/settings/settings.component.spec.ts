import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { ElectronService } from '../../core/services/electron.service';
import { NotificationService } from '../../core/services/notification.service';
import { DialogService } from '../../core/services/dialog.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { AppSettings, ImportResultT, MovementDraftT } from '@shared/types';

const ACCOUNTS = [{ id: 1, name: 'Main', isDefault: true, startingBalance: 0 }];

function makeMocks(settings: Partial<AppSettings> = {}, failLoad = false) {
  const defaults: AppSettings = { useDefaultDate: false, defaultDate: '', colorOrder: [], categoryIcons: [] };
  const merged = { ...defaults, ...settings };

  const mockElectron = {
    getSettings: vi.fn(() => (failLoad ? throwError(() => new Error('UNKNOWN')) : of(merged))),
    saveSettings: vi.fn(() => of(undefined)),
    getAllAccounts: vi.fn(() => of(ACCOUNTS)),
    previewImport: vi.fn(() => of<ImportResultT | null>(null)),
    commitImport: vi.fn(() => of(0)),
    exportMovements: vi.fn(() => of<string | null>(null)),
    backupDatabase: vi.fn(() => of<string | null>(null)),
    restoreDatabase: vi.fn(() => of(true)),
    dropAllTables: vi.fn(() => of(undefined)),
    seedExampleData: vi.fn(() => of(undefined)),
  };
  const notifyError = vi.fn();
  const notifySuccess = vi.fn();
  const mockNotify = { error: notifyError, success: notifySuccess, info: vi.fn() };
  const mockDialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
  const mockConfirm = { confirm: vi.fn(() => of(true)) };

  return { mockElectron, mockNotify, mockDialog, mockConfirm, notifyError, notifySuccess };
}

function setup(settings: Partial<AppSettings> = {}, failLoad = false) {
  const mocks = makeMocks(settings, failLoad);

  TestBed.configureTestingModule({
    imports: [SettingsComponent],
    providers: [
      { provide: ElectronService, useValue: mocks.mockElectron },
      { provide: NotificationService, useValue: mocks.mockNotify },
      { provide: DialogService, useValue: mocks.mockDialog },
      { provide: ConfirmService, useValue: mocks.mockConfirm },
    ],
  });

  const fixture = TestBed.createComponent(SettingsComponent);
  fixture.detectChanges();
  return { fixture, ...mocks };
}

function makeDraft(): MovementDraftT {
  return {
    name: 'X', concept: 'X', quantityCents: 100, isPositive: false, date: new Date('2026-06-01'),
    categoryName: 'Food', categoryId: 1, envelopes: [{ name: 'E', id: 1, amountCents: 100 }],
    tags: [], additionalNotes: null, isAnomalous: false, templateName: null, groupName: null,
  };
}

describe('SettingsComponent', () => {
  it('loads settings on init and reflects useDefaultDate', () => {
    const { fixture } = setup({ useDefaultDate: true, defaultDate: '2024-06-01' });
    const comp = fixture.componentInstance;
    expect(comp.useDefaultDate).toBe(true);
    expect(comp.defaultDate).toBe('2024-06-01');
  });

  it('calls saveSettings when useDefaultDate is toggled', () => {
    const { fixture, mockElectron } = setup({ useDefaultDate: false });
    fixture.componentInstance.onUseDefaultDateChange(true);
    expect(mockElectron.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ useDefaultDate: true }),
    );
  });

  it('calls saveSettings when defaultDate is changed', () => {
    const { fixture, mockElectron } = setup({ useDefaultDate: true, defaultDate: '2024-01-01' });
    fixture.componentInstance.onDefaultDateChange('2024-12-31');
    expect(mockElectron.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ defaultDate: '2024-12-31' }),
    );
  });

  it('shows an error toast when getSettings fails', () => {
    const { notifyError } = setup({}, true);
    expect(notifyError).toHaveBeenCalled();
  });

  it('defaults the import account to the default account', () => {
    const { fixture } = setup();
    expect(fixture.componentInstance['selectedAccountId']).toBe(1);
  });

  describe('data management', () => {
    it('toasts the saved path after Export all', () => {
      const { fixture, mockElectron, notifySuccess } = setup();
      mockElectron.exportMovements.mockReturnValue(of('/tmp/movements.csv'));
      fixture.componentInstance.onExportAll();
      expect(mockElectron.exportMovements).toHaveBeenCalled();
      expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining('/tmp/movements.csv'));
    });

    it('does not toast when Export is cancelled', () => {
      const { fixture, mockElectron, notifySuccess } = setup();
      mockElectron.exportMovements.mockReturnValue(of(null));
      fixture.componentInstance.onExportAll();
      expect(notifySuccess).not.toHaveBeenCalled();
    });

    it('toasts the saved path after Back up', () => {
      const { fixture, mockElectron, notifySuccess } = setup();
      mockElectron.backupDatabase.mockReturnValue(of('/tmp/backup.db'));
      fixture.componentInstance.onBackup();
      expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining('/tmp/backup.db'));
    });

    it('previews then commits an import on confirm', () => {
      const { fixture, mockElectron, mockDialog, notifySuccess } = setup();
      const result: ImportResultT = { drafts: [makeDraft()], issues: [] };
      mockElectron.previewImport.mockReturnValue(of(result));
      mockElectron.commitImport.mockReturnValue(of(1));

      fixture.componentInstance.onImport();

      expect(mockElectron.previewImport).toHaveBeenCalledWith(1);
      expect(mockDialog.open).toHaveBeenCalled();
      expect(mockElectron.commitImport).toHaveBeenCalledWith(result.drafts, 1);
      expect(notifySuccess).toHaveBeenCalled();
    });

    it('does nothing when the file picker is cancelled', () => {
      const { fixture, mockElectron, mockDialog } = setup();
      mockElectron.previewImport.mockReturnValue(of(null));
      fixture.componentInstance.onImport();
      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockElectron.commitImport).not.toHaveBeenCalled();
    });

    it('does not commit when the preview dialog is cancelled', () => {
      const { fixture, mockElectron, mockDialog } = setup();
      mockElectron.previewImport.mockReturnValue(of<ImportResultT>({ drafts: [makeDraft()], issues: [] }));
      mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });
      fixture.componentInstance.onImport();
      expect(mockElectron.commitImport).not.toHaveBeenCalled();
    });

    describe('whole-DB actions', () => {
      let reloadSpy: ReturnType<typeof vi.spyOn>;
      beforeEach(() => {
        reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
      });
      afterEach(() => reloadSpy.mockRestore());

      it('restores and reloads after confirmation', () => {
        const { fixture, mockElectron, mockConfirm } = setup();
        mockConfirm.confirm.mockReturnValue(of(true));
        mockElectron.restoreDatabase.mockReturnValue(of(true));
        fixture.componentInstance.onRestore();
        expect(mockElectron.restoreDatabase).toHaveBeenCalled();
        expect(reloadSpy).toHaveBeenCalled();
      });

      it('does not restore when the confirmation is declined', () => {
        const { fixture, mockElectron, mockConfirm } = setup();
        mockConfirm.confirm.mockReturnValue(of(false));
        fixture.componentInstance.onRestore();
        expect(mockElectron.restoreDatabase).not.toHaveBeenCalled();
        expect(reloadSpy).not.toHaveBeenCalled();
      });

      it('seeds example data and reloads', () => {
        const { fixture, mockElectron } = setup();
        fixture.componentInstance.onSeedData();
        expect(mockElectron.seedExampleData).toHaveBeenCalled();
        expect(reloadSpy).toHaveBeenCalled();
      });
    });
  });
});
