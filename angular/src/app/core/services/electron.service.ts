import { Injectable } from '@angular/core';
import { from } from 'rxjs';
import {
  Movement,
  Category,
  MovementFilter,
  AppSettings,
  Account,
  Envelope,
  Tag,
} from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private movements = window.movements;
  private categories = window.categories;
  private accounts = window.accounts;
  private envelopes = window.envelopes;
  private tags = window.tags;
  private settings = window.settings;

  // Movements
  createMovement(
    name: string,
    concept: string | null,
    quantityCents: number,
    isPositive: boolean,
    date: Date,
    categoryId: number,
    envelopeId: number,
    additionalNotes: string | null,
  ) {
    return from(
      this.movements.create(
        name,
        concept,
        quantityCents,
        isPositive,
        date,
        categoryId,
        envelopeId,
        additionalNotes,
      ),
    );
  }

  getAllMovements(filter?: MovementFilter) {
    return from(this.movements.getAll(filter));
  }

  getMovementById(id: number) {
    return from(this.movements.getById(id));
  }

  updateMovement(movement: Movement) {
    return from(this.movements.update(movement));
  }

  deleteMovement(id: number) {
    return from(this.movements.delete(id));
  }

  deleteManyMovements(ids: number[]) {
    return from(this.movements.deleteMany(ids));
  }

  suggestMovementNames(prefix: string, limit?: number) {
    return from(this.movements.suggestNames(prefix, limit));
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

  updateCategory(category: Category) {
    return from(this.categories.update(category));
  }

  deleteCategory(id: number) {
    return from(this.categories.delete(id));
  }

  setDefaultCategory(id: number) {
    return from(this.categories.setDefault(id));
  }

  // Accounts
  createAccount(name: string, description?: string) {
    return from(this.accounts.create(name, description));
  }

  getAllAccounts() {
    return from(this.accounts.getAll());
  }

  getAccountById(id: number) {
    return from(this.accounts.getById(id));
  }

  updateAccount(account: Account) {
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
  createEnvelope(name: string, accountId: number) {
    return from(this.envelopes.create(name, accountId));
  }

  getAllEnvelopes() {
    return from(this.envelopes.getAll());
  }

  getEnvelopeById(id: number) {
    return from(this.envelopes.getById(id));
  }

  updateEnvelope(envelope: Envelope) {
    return from(this.envelopes.update(envelope));
  }

  deleteEnvelope(id: number) {
    return from(this.envelopes.delete(id));
  }

  setDefaultEnvelope(id: number) {
    return from(this.envelopes.setDefault(id));
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

  updateTag(tag: Tag) {
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
