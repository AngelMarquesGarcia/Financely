import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('electron', () => ({
  app: { getPath: jest.fn().mockReturnValue('/tmp/financely-test-settings') },
}));

const storeData: Record<string, unknown> = {};

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(({ defaults }: { defaults: Record<string, unknown> }) => ({
    get: (key: string) => key in storeData ? storeData[key] : defaults[key],
    set: (key: string, value: unknown) => { storeData[key] = value; },
  }));
});

import { getAllSettings, saveSettings } from '../../services/settings.service';

describe('SettingsService', () => {
  beforeEach(() => {
    for (const k in storeData) delete storeData[k];
  });

  it('getAll returns default values on fresh store', () => {
    const s = getAllSettings();
    expect(s.useDefaultDate).toBe(false);
    expect(s.defaultDate).toBe('');
    expect(Array.isArray(s.colorOrder)).toBe(true);
    expect(s.colorOrder.length).toBeGreaterThan(0);
    expect(Array.isArray(s.categoryIcons)).toBe(true);
    expect(s.categoryIcons.length).toBeGreaterThan(0);
  });

  it('save persists useDefaultDate', () => {
    saveSettings({ useDefaultDate: true });
    expect(getAllSettings().useDefaultDate).toBe(true);
  });

  it('save merges partial — unset keys keep defaults', () => {
    saveSettings({ defaultDate: '2024-06-01' });
    const s = getAllSettings();
    expect(s.defaultDate).toBe('2024-06-01');
    expect(s.useDefaultDate).toBe(false);
  });

  it('save overwrites previous value', () => {
    saveSettings({ defaultDate: '2024-01-01' });
    saveSettings({ defaultDate: '2024-12-31' });
    expect(getAllSettings().defaultDate).toBe('2024-12-31');
  });
});
