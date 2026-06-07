import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { ElectronService } from '../../core/services/electron.service';
import { NotificationService } from '../../core/services/notification.service';
import { AppSettings } from '@shared/types';

function makeMocks(settings: Partial<AppSettings> = {}, failLoad = false) {
  const defaults: AppSettings = { useDefaultDate: false, defaultDate: '', colorOrder: [] };
  const merged = { ...defaults, ...settings };

  const mockElectron = {
    getSettings: vi.fn(() => (failLoad ? throwError(() => new Error('UNKNOWN')) : of(merged))),
    saveSettings: vi.fn(() => of(undefined)),
  };
  const notifyError = vi.fn();
  const mockNotify = { error: notifyError, success: vi.fn(), info: vi.fn() };

  return { mockElectron, mockNotify, notifyError };
}

function setup(settings: Partial<AppSettings> = {}, failLoad = false) {
  const { mockElectron, mockNotify, notifyError } = makeMocks(settings, failLoad);

  TestBed.configureTestingModule({
    imports: [SettingsComponent],
    providers: [
      { provide: ElectronService, useValue: mockElectron },
      { provide: NotificationService, useValue: mockNotify },
    ],
  });

  const fixture = TestBed.createComponent(SettingsComponent);
  fixture.detectChanges();
  return { fixture, mockElectron, notifyError };
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
});
