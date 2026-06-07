import Store from 'electron-store';
import { AppSettings } from '@shared/types';

const DEFAULT_COLOR_ORDER = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
  '#0f172a',
];

export const DEFAULT_CATEGORY_ICONS = [
  '💰', '💸', '🛒', '🍕', '🏠', '🚗', '💊', '✈️', '🎬', '🎮',
  '📱', '👕', '💡', '🏋️', '📚', '🎁', '🐾', '🎵', '💼', '🍔',
];

const store = new Store<AppSettings>({
  defaults: {
    useDefaultDate: false,
    defaultDate: '',
    colorOrder: DEFAULT_COLOR_ORDER,
    categoryIcons: DEFAULT_CATEGORY_ICONS,
  },
});

export function getAllSettings(): AppSettings {
  return {
    useDefaultDate: store.get('useDefaultDate'),
    defaultDate: store.get('defaultDate'),
    colorOrder: store.get('colorOrder'),
    categoryIcons: store.get('categoryIcons'),
  };
}

export function saveSettings(partial: Partial<AppSettings>): void {
  (Object.keys(partial) as (keyof AppSettings)[]).forEach((key) => {
    store.set(key, partial[key] as AppSettings[typeof key]);
  });
}
