import { Injectable } from '@angular/core';
import { vi } from 'vitest';
import { of, Observable } from 'rxjs';
import { ElectronService } from '../app/core/services/electron.service';
import { MovementT, CategoryT, AppSettings, AccountT, EnvelopeT, TagT } from '@shared/types';

@Injectable()
export class MockElectronService implements Partial<ElectronService> {
  createMovement = vi.fn(
    (
      _name: string,
      _concept: string | null,
      _quantityCents: number,
      _isPositive: boolean,
      _date: Date,
      _categoryId: number,
      _envelopeIdMap: Map<number, number>,
      _additionalNotes: string | null,
    ): Observable<number> => of(1),
  );
  getAllMovements = vi.fn((): Observable<MovementT[]> => of([]));
  getMovementById = vi.fn((_id: number): Observable<MovementT | undefined> => of(undefined));
  updateMovement = vi.fn((_movement: MovementT): Observable<boolean> => of(true));
  deleteMovement = vi.fn((_id: number): Observable<boolean> => of(true));
  confirmMovement = vi.fn((_id: number): Observable<boolean> => of(true));
  runDuePeriodicMovements = vi.fn((): Observable<number> => of(0));

  createCategory = vi.fn(
    (
      _name: string,
      _color?: string,
      _emoji?: string,
      _envelopeId?: number | null,
    ): Observable<number> => of(1),
  );
  getAllCategories = vi.fn((): Observable<CategoryT[]> => of([]));
  getCategoryById = vi.fn((_id: number): Observable<CategoryT | undefined> => of(undefined));
  updateCategory = vi.fn((_category: CategoryT): Observable<boolean> => of(true));
  deleteCategory = vi.fn((_id: number): Observable<boolean> => of(true));
  setDefaultCategory = vi.fn((_id: number): Observable<void> => of(undefined));

  createAccount = vi.fn((_name: string, _description?: string): Observable<number> => of(1));
  getAllAccounts = vi.fn((): Observable<AccountT[]> => of([]));
  getAccountById = vi.fn((_id: number): Observable<AccountT | undefined> => of(undefined));
  updateAccount = vi.fn((_account: AccountT): Observable<boolean> => of(true));
  deleteAccount = vi.fn((_id: number): Observable<boolean> => of(true));
  setDefaultAccount = vi.fn((_id: number): Observable<void> => of(undefined));

  createEnvelope = vi.fn((_name: string, _accountId: number): Observable<number> => of(1));
  getAllEnvelopes = vi.fn((): Observable<EnvelopeT[]> => of([]));
  getEnvelopeById = vi.fn((_id: number): Observable<EnvelopeT | undefined> => of(undefined));
  updateEnvelope = vi.fn((_envelope: EnvelopeT): Observable<boolean> => of(true));
  deleteEnvelope = vi.fn((_id: number): Observable<boolean> => of(true));
  setDefaultEnvelope = vi.fn((_id: number): Observable<void> => of(undefined));

  createTag = vi.fn(
    (_type: string, _name: string, _color: string): Observable<number> => of(1),
  );
  getAllTags = vi.fn((): Observable<TagT[]> => of([]));
  getTagById = vi.fn((_id: number): Observable<TagT | undefined> => of(undefined));
  updateTag = vi.fn((_tag: TagT): Observable<boolean> => of(true));
  deleteTag = vi.fn((_id: number): Observable<boolean> => of(true));

  getSettings = vi.fn(
    (): Observable<AppSettings> =>
      of({ useDefaultDate: false, defaultDate: '', colorOrder: [], categoryIcons: [] }),
  );
  saveSettings = vi.fn((_partial: Partial<AppSettings>): Observable<void> => of(undefined));
}
