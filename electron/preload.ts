import { contextBridge, ipcRenderer } from 'electron';
import { Channels } from './ipc/channels';
import { MovementT, CategoryT, MovementFilter, AppSettings, AccountT, EnvelopeT, TagT, PeriodSummaryT, PeriodicMovementT } from '../shared/types';

type NewPeriodicTemplate = Omit<
  PeriodicMovementT,
  'id' | 'active' | 'lastCreatedYear' | 'lastCreatedMonth' | 'startYear' | 'startMonth'
>;

contextBridge.exposeInMainWorld('movements', {
  create: (
    name: string,
    concept: string | null,
    quantityCents: number,
    isPositive: boolean,
    date: Date,
    categoryId: number,
    envelopeIdMap: Map<number, number>,
    additionalNotes: string | null,
  ) =>
    ipcRenderer.invoke(Channels.MOVEMENT_CREATE, {
      name,
      concept,
      quantityCents,
      isPositive,
      date,
      categoryId,
      envelopeIdMap,
      additionalNotes,
    }),
  getAll: (filter?: MovementFilter) => ipcRenderer.invoke(Channels.MOVEMENT_GET_ALL, filter),
  getById: (id: number) => ipcRenderer.invoke(Channels.MOVEMENT_GET_BY_ID, id),
  update: (movement: MovementT) => ipcRenderer.invoke(Channels.MOVEMENT_UPDATE, movement),
  delete: (id: number) => ipcRenderer.invoke(Channels.MOVEMENT_DELETE, id),
  deleteMany: (ids: number[]) => ipcRenderer.invoke(Channels.MOVEMENT_DELETE_MANY, ids),
  confirm: (id: number) => ipcRenderer.invoke(Channels.MOVEMENT_CONFIRM, id),
  suggestNames: (prefix: string, limit?: number) =>
    ipcRenderer.invoke(Channels.MOVEMENT_SUGGEST_NAMES, { prefix, limit }),
});

contextBridge.exposeInMainWorld('periodicMovements', {
  create: (template: NewPeriodicTemplate, tagIds: number[]) =>
    ipcRenderer.invoke(Channels.PERIODIC_CREATE, { template, tagIds }),
  getAll: () => ipcRenderer.invoke(Channels.PERIODIC_GET_ALL),
  getById: (id: number) => ipcRenderer.invoke(Channels.PERIODIC_GET_BY_ID, id),
  getTagsForPeriodicMovement: (id: number) => ipcRenderer.invoke(Channels.PERIODIC_GET_TAGS, id),
  update: (template: PeriodicMovementT, tagIds: number[]) =>
    ipcRenderer.invoke(Channels.PERIODIC_UPDATE, { template, tagIds }),
  delete: (id: number) => ipcRenderer.invoke(Channels.PERIODIC_DELETE, id),
  setActive: (id: number, active: boolean) =>
    ipcRenderer.invoke(Channels.PERIODIC_SET_ACTIVE, { id, active }),
  runDue: () => ipcRenderer.invoke(Channels.PERIODIC_RUN_DUE),
  instantiateCurrentMonthEarly: (
    id: number,
    date?: Date,
    amountCents?: number,
    envelopeIdMap?: Map<number, number>,
  ) =>
    ipcRenderer.invoke(Channels.PERIODIC_INSTANTIATE_CURRENT, {
      id,
      date,
      amountCents,
      envelopeIdMap,
    }),
  createAdditionalInstance: (
    id: number,
    date: Date,
    amountCents?: number,
    envelopeIdMap?: Map<number, number>,
  ) =>
    ipcRenderer.invoke(Channels.PERIODIC_CREATE_ADDITIONAL, { id, date, amountCents, envelopeIdMap }),
});

contextBridge.exposeInMainWorld('transfers', {
  create: (
    fromEnvelopeId: number,
    toEnvelopeId: number,
    quantityCents: number,
    date: Date,
    notes: string | null = null,
  ) =>
    ipcRenderer.invoke(Channels.TRANSFER_CREATE, {
      fromEnvelopeId,
      toEnvelopeId,
      quantityCents,
      date,
      notes,
    }),
  getAll: () => ipcRenderer.invoke(Channels.TRANSFER_GET_ALL),
  getForEnvelope: (envelopeId: number) =>
    ipcRenderer.invoke(Channels.TRANSFER_GET_FOR_ENVELOPE, envelopeId),
  delete: (id: number) => ipcRenderer.invoke(Channels.TRANSFER_DELETE, id),
});

contextBridge.exposeInMainWorld('categories', {
  create: (name: string, color?: string, emoji?: string, envelopeId: number | null = null) =>
    ipcRenderer.invoke(Channels.CATEGORY_CREATE, { name, color, emoji, envelopeId }),
  getAll: () => ipcRenderer.invoke(Channels.CATEGORY_GET_ALL),
  getById: (id: number) => ipcRenderer.invoke(Channels.CATEGORY_GET_BY_ID, id),
  update: (category: CategoryT) => ipcRenderer.invoke(Channels.CATEGORY_UPDATE, category),
  delete: (id: number) => ipcRenderer.invoke(Channels.CATEGORY_DELETE, id),
  setDefault: (id: number) => ipcRenderer.invoke(Channels.CATEGORY_SET_DEFAULT, id),
});

contextBridge.exposeInMainWorld('accounts', {
  create: (name: string, description?: string, startingBalance?: number) => ipcRenderer.invoke(Channels.ACCOUNT_CREATE, { name, description, startingBalance }),
  getAll: () => ipcRenderer.invoke(Channels.ACCOUNT_GET_ALL),
  getById: (id: number) => ipcRenderer.invoke(Channels.ACCOUNT_GET_BY_ID, id),
  update: (account: AccountT) => ipcRenderer.invoke(Channels.ACCOUNT_UPDATE, account),
  delete: (id: number) => ipcRenderer.invoke(Channels.ACCOUNT_DELETE, id),
  setDefault: (id: number) => ipcRenderer.invoke(Channels.ACCOUNT_SET_DEFAULT, id),
  getStats: () => ipcRenderer.invoke(Channels.ACCOUNT_GET_STATS),
});

contextBridge.exposeInMainWorld('envelopes', {
  create: (
    name: string,
    accountId: number,
    startingBalance?: number,
    budgetCents?: number | null,
    maxSavingsCents?: number | null,
    overflowsTo?: number | null,
  ) =>
    ipcRenderer.invoke(Channels.ENVELOPE_CREATE, {
      name,
      accountId,
      startingBalance,
      budgetCents,
      maxSavingsCents,
      overflowsTo,
    }),
  getAll: () => ipcRenderer.invoke(Channels.ENVELOPE_GET_ALL),
  getById: (id: number) => ipcRenderer.invoke(Channels.ENVELOPE_GET_BY_ID, id),
  update: (envelope: EnvelopeT) => ipcRenderer.invoke(Channels.ENVELOPE_UPDATE, envelope),
  delete: (id: number) => ipcRenderer.invoke(Channels.ENVELOPE_DELETE, id),
  setDefault: (id: number) => ipcRenderer.invoke(Channels.ENVELOPE_SET_DEFAULT, id),
});

contextBridge.exposeInMainWorld('tags', {
  create: (type: string, name: string, color: string) =>
    ipcRenderer.invoke(Channels.TAG_CREATE, { type, name, color }),
  getAll: () => ipcRenderer.invoke(Channels.TAG_GET_ALL),
  getById: (id: number) => ipcRenderer.invoke(Channels.TAG_GET_BY_ID, id),
  update: (tag: TagT) => ipcRenderer.invoke(Channels.TAG_UPDATE, tag),
  delete: (id: number) => ipcRenderer.invoke(Channels.TAG_DELETE, id),
  addToMovement: (tagId: number, movementId: number) =>
    ipcRenderer.invoke(Channels.TAG_ADD_TO_MOVEMENT, { tagId, movementId }),
  removeFromMovement: (tagId: number, movementId: number) =>
    ipcRenderer.invoke(Channels.TAG_REMOVE_FROM_MOVEMENT, { tagId, movementId }),
  getForMovement: (movementId: number) =>
    ipcRenderer.invoke(Channels.TAG_GET_FOR_MOVEMENT, movementId),
  getForMovements: (movementIds: number[]) =>
    ipcRenderer.invoke(Channels.TAG_GET_FOR_MOVEMENTS, movementIds),
});

contextBridge.exposeInMainWorld('periodSummaries', {
  create: (summary: PeriodSummaryT) =>
    ipcRenderer.invoke(Channels.PERIOD_SUMMARY_CREATE, summary),
  upsert: (summary: PeriodSummaryT) =>
    ipcRenderer.invoke(Channels.PERIOD_SUMMARY_UPSERT, summary),
  getAll: () => ipcRenderer.invoke(Channels.PERIOD_SUMMARY_GET_ALL),
  getLatest: (envelopeId: number) =>
    ipcRenderer.invoke(Channels.PERIOD_SUMMARY_GET_LATEST, envelopeId),
  getByPeriod: (accountId: number, envelopeId: number | null, year: number, month: number) =>
    ipcRenderer.invoke(Channels.PERIOD_SUMMARY_GET_BY_PERIOD, { accountId, envelopeId, year, month }),
  update: (summary: PeriodSummaryT) => ipcRenderer.invoke(Channels.PERIOD_SUMMARY_UPDATE, summary),
  delete: (accountId: number, envelopeId: number | null, year: number, month: number) =>
    ipcRenderer.invoke(Channels.PERIOD_SUMMARY_DELETE, { accountId, envelopeId, year, month }),
});

contextBridge.exposeInMainWorld('settings', {
  getAll: (): Promise<AppSettings> => ipcRenderer.invoke(Channels.SETTINGS_GET),
  save: (partial: Partial<AppSettings>): Promise<void> =>
    ipcRenderer.invoke(Channels.SETTINGS_SET, partial),
});
