import type {
  Movements,
  Categories,
  Accounts,
  Envelopes,
  Tags,
  Settings,
} from '@shared/interfaces';

declare global {
  interface Window {
    movements: Movements;
    categories: Categories;
    accounts: Accounts;
    envelopes: Envelopes;
    tags: Tags;
    settings: Settings;
  }
}

export {};
