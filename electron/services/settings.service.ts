import Store from 'electron-store';
import { AppSettings } from '@shared/types';
import { DEFAULT_COLOR_ORDER, DEFAULT_CATEGORY_ICONS } from '@shared/defaults';

export class SettingsService {
  private readonly store = new Store<AppSettings>({
    defaults: {
      useDefaultDate: false,
      defaultDate: '',
      colorOrder: [...DEFAULT_COLOR_ORDER],
      categoryIcons: [...DEFAULT_CATEGORY_ICONS],
    },
  });

  getAll(): AppSettings {
    return {
      useDefaultDate: this.store.get('useDefaultDate'),
      defaultDate: this.store.get('defaultDate'),
      colorOrder: this.store.get('colorOrder'),
      categoryIcons: this.store.get('categoryIcons'),
    };
  }

  save(partial: Partial<AppSettings>): void {
    (Object.keys(partial) as (keyof AppSettings)[]).forEach((key) => {
      this.store.set(key, partial[key] as AppSettings[typeof key]);
    });
  }
}

export const settingsService = new SettingsService();
