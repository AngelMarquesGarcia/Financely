import type {
  Movements,
  PeriodicMovements,
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
    periodicMovements: PeriodicMovements;
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
