import type {
  Movements,
  Transfers,
  Categories,
  Accounts,
  Envelopes,
  Tags,
  Settings,
  PeriodSummaries,
} from '@shared/interfaces';

declare global {
  interface Window {
    movements: Movements;
    transfers: Transfers;
    categories: Categories;
    accounts: Accounts;
    envelopes: Envelopes;
    tags: Tags;
    settings: Settings;
    periodSummaries: PeriodSummaries;
  }
}

export {};
