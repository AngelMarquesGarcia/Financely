import { Injectable } from '@angular/core';
import { from } from 'rxjs';
import {
  MovementT,
  CategoryT,
  MovementFilter,
  AppSettings,
  AccountT,
  EnvelopeT,
  TagT,
  PeriodicMovementT,
} from '@shared/types';

type NewPeriodicTemplate = Omit<
  PeriodicMovementT,
  'id' | 'active' | 'lastCreatedYear' | 'lastCreatedMonth' | 'startYear' | 'startMonth'
>;

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private movements = window.movements;
  private periodicMovements = window.periodicMovements;
  private transfers = window.transfers;
  private categories = window.categories;
  private accounts = window.accounts;
  private envelopes = window.envelopes;
  private tags = window.tags;
  private settings = window.settings;
  private periodSummaries = window.periodSummaries;

  // Movements
  createMovement(
    name: string,
    concept: string | null,
    quantityCents: number,
    isPositive: boolean,
    date: Date,
    categoryId: number,
    envelopeIdMap: Map<number, number>,
    additionalNotes: string | null,
    isAnomalous = false,
  ) {
    return from(
      this.movements.create(
        name,
        concept,
        quantityCents,
        isPositive,
        date,
        categoryId,
        envelopeIdMap,
        additionalNotes,
        isAnomalous,
      ),
    );
  }

  getAllMovements(filter?: MovementFilter) {
    return from(this.movements.getAll(filter));
  }

  getMovementById(id: number) {
    return from(this.movements.getById(id));
  }

  updateMovement(movement: MovementT) {
    return from(this.movements.update(movement));
  }

  deleteMovement(id: number) {
    return from(this.movements.delete(id));
  }

  deleteManyMovements(ids: number[]) {
    return from(this.movements.deleteMany(ids));
  }

  confirmMovement(id: number) {
    return from(this.movements.confirm(id));
  }

  suggestMovementNames(prefix: string, limit?: number) {
    return from(this.movements.suggestNames(prefix, limit));
  }

  getFilterSummary(filter: MovementFilter) {
    return from(this.movements.getFilterSummary(filter));
  }

  // Periodic movements
  createPeriodicMovement(template: NewPeriodicTemplate, tagIds: number[]) {
    return from(this.periodicMovements.create(template, tagIds));
  }

  getAllPeriodicMovements() {
    return from(this.periodicMovements.getAll());
  }

  getPeriodicMovementById(id: number) {
    return from(this.periodicMovements.getById(id));
  }

  getTagsForPeriodicMovement(id: number) {
    return from(this.periodicMovements.getTagsForPeriodicMovement(id));
  }

  updatePeriodicMovement(template: PeriodicMovementT, tagIds: number[]) {
    return from(this.periodicMovements.update(template, tagIds));
  }

  deletePeriodicMovement(id: number) {
    return from(this.periodicMovements.delete(id));
  }

  setPeriodicMovementActive(id: number, active: boolean) {
    return from(this.periodicMovements.setActive(id, active));
  }

  runDuePeriodicMovements() {
    return from(this.periodicMovements.runDue());
  }

  instantiatePeriodicMovementCurrentMonth(
    id: number,
    date?: Date,
    amountCents?: number,
    envelopeIdMap?: Map<number, number>,
  ) {
    return from(
      this.periodicMovements.instantiateCurrentMonthEarly(id, date, amountCents, envelopeIdMap),
    );
  }

  createAdditionalPeriodicInstance(
    id: number,
    date: Date,
    amountCents?: number,
    envelopeIdMap?: Map<number, number>,
  ) {
    return from(
      this.periodicMovements.createAdditionalInstance(id, date, amountCents, envelopeIdMap),
    );
  }

  // Transfers
  createTransfer(
    fromEnvelopeId: number,
    toEnvelopeId: number,
    quantityCents: number,
    date: Date,
    notes: string | null = null,
  ) {
    return from(this.transfers.create(fromEnvelopeId, toEnvelopeId, quantityCents, date, notes));
  }

  getAllTransfers() {
    return from(this.transfers.getAll());
  }

  getTransfersForEnvelope(envelopeId: number) {
    return from(this.transfers.getForEnvelope(envelopeId));
  }

  deleteTransfer(id: number) {
    return from(this.transfers.delete(id));
  }

  // Categories
  createCategory(name: string, color?: string, emoji?: string, envelopeId: number | null = null) {
    return from(this.categories.create(name, color, emoji, envelopeId));
  }

  getAllCategories() {
    return from(this.categories.getAll());
  }

  getCategoryById(id: number) {
    return from(this.categories.getById(id));
  }

  updateCategory(category: CategoryT) {
    return from(this.categories.update(category));
  }

  deleteCategory(id: number) {
    return from(this.categories.delete(id));
  }

  setDefaultCategory(id: number) {
    return from(this.categories.setDefault(id));
  }

  // Accounts
  createAccount(name: string, description?: string, startingBalance?: number) {
    return from(this.accounts.create(name, description, startingBalance));
  }

  getAllAccounts() {
    return from(this.accounts.getAll());
  }

  getAccountById(id: number) {
    return from(this.accounts.getById(id));
  }

  updateAccount(account: AccountT) {
    return from(this.accounts.update(account));
  }

  deleteAccount(id: number) {
    return from(this.accounts.delete(id));
  }

  setDefaultAccount(id: number) {
    return from(this.accounts.setDefault(id));
  }

  getAccountStats() {
    return from(this.accounts.getStats());
  }

  // Envelopes
  createEnvelope(
    name: string,
    accountId: number,
    startingBalance?: number,
    budgetCents?: number | null,
    maxSavingsCents?: number | null,
    overflowsTo?: number | null,
  ) {
    return from(
      this.envelopes.create(name, accountId, startingBalance, budgetCents, maxSavingsCents, overflowsTo),
    );
  }

  getAllEnvelopes() {
    return from(this.envelopes.getAll());
  }

  getEnvelopeById(id: number) {
    return from(this.envelopes.getById(id));
  }

  updateEnvelope(envelope: EnvelopeT) {
    return from(this.envelopes.update(envelope));
  }

  deleteEnvelope(id: number) {
    return from(this.envelopes.delete(id));
  }

  setDefaultEnvelope(id: number) {
    return from(this.envelopes.setDefault(id));
  }

  // Period summaries
  getAllPeriodSummaries() {
    return from(this.periodSummaries.getAll());
  }

  getLatestPeriodSummary(envelopeId: number) {
    return from(this.periodSummaries.getLatest(envelopeId));
  }

  // Tags
  createTag(type: string, name: string, color: string) {
    return from(this.tags.create(type, name, color));
  }

  getAllTags() {
    return from(this.tags.getAll());
  }

  getTagById(id: number) {
    return from(this.tags.getById(id));
  }

  updateTag(tag: TagT) {
    return from(this.tags.update(tag));
  }

  deleteTag(id: number) {
    return from(this.tags.delete(id));
  }

  addTagToMovement(tagId: number, movementId: number) {
    return from(this.tags.addToMovement(tagId, movementId));
  }

  removeTagFromMovement(tagId: number, movementId: number) {
    return from(this.tags.removeFromMovement(tagId, movementId));
  }

  getTagsForMovement(movementId: number) {
    return from(this.tags.getForMovement(movementId));
  }

  getTagsForMovements(movementIds: number[]) {
    return from(this.tags.getForMovements(movementIds));
  }

  // Settings
  getSettings() {
    return from(this.settings.getAll());
  }

  saveSettings(partial: Partial<AppSettings>) {
    return from(this.settings.save(partial));
  }
}
