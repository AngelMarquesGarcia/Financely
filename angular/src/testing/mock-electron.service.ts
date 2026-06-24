import { Injectable } from '@angular/core';
import { of, Observable } from 'rxjs';
import { ElectronService } from '../app/core/services/electron.service';
import { MovementT, CategoryT, AppSettings, AccountT, EnvelopeT, TagT } from '@shared/types';

@Injectable()
export class MockElectronService implements Partial<ElectronService> {
  createMovement = jest.fn(
    (
      _name: string,
      _concept: string | null,
      _quantityCents: number,
      _isPositive: boolean,
      _date: Date,
      _categoryId: number,
      _envelopeId: number,
      _additionalNotes: string | null,
    ): Observable<number> => of(1),
  );
  getAllMovements = jest.fn((): Observable<MovementT[]> => of([]));
  getMovementById = jest.fn((_id: number): Observable<MovementT | undefined> => of(undefined));
  updateMovement = jest.fn((_movement: MovementT): Observable<boolean> => of(true));
  deleteMovement = jest.fn((_id: number): Observable<boolean> => of(true));

  createCategory = jest.fn(
    (
      _name: string,
      _color?: string,
      _emoji?: string,
      _envelopeId?: number | null,
    ): Observable<number> => of(1),
  );
  getAllCategories = jest.fn((): Observable<CategoryT[]> => of([]));
  getCategoryById = jest.fn((_id: number): Observable<CategoryT | undefined> => of(undefined));
  updateCategory = jest.fn((_category: CategoryT): Observable<boolean> => of(true));
  deleteCategory = jest.fn((_id: number): Observable<boolean> => of(true));
  setDefaultCategory = jest.fn((_id: number): Observable<void> => of(undefined));

  createAccount = jest.fn((_name: string, _description?: string): Observable<number> => of(1));
  getAllAccounts = jest.fn((): Observable<AccountT[]> => of([]));
  getAccountById = jest.fn((_id: number): Observable<AccountT | undefined> => of(undefined));
  updateAccount = jest.fn((_account: AccountT): Observable<boolean> => of(true));
  deleteAccount = jest.fn((_id: number): Observable<boolean> => of(true));
  setDefaultAccount = jest.fn((_id: number): Observable<void> => of(undefined));

  createEnvelope = jest.fn((_name: string, _accountId: number): Observable<number> => of(1));
  getAllEnvelopes = jest.fn((): Observable<EnvelopeT[]> => of([]));
  getEnvelopeById = jest.fn((_id: number): Observable<EnvelopeT | undefined> => of(undefined));
  updateEnvelope = jest.fn((_envelope: EnvelopeT): Observable<boolean> => of(true));
  deleteEnvelope = jest.fn((_id: number): Observable<boolean> => of(true));
  setDefaultEnvelope = jest.fn((_id: number): Observable<void> => of(undefined));

  createTag = jest.fn(
    (_type: string, _name: string, _color: string): Observable<number> => of(1),
  );
  getAllTags = jest.fn((): Observable<TagT[]> => of([]));
  getTagById = jest.fn((_id: number): Observable<TagT | undefined> => of(undefined));
  updateTag = jest.fn((_tag: TagT): Observable<boolean> => of(true));
  deleteTag = jest.fn((_id: number): Observable<boolean> => of(true));

  getSettings = jest.fn(
    (): Observable<AppSettings> =>
      of({ useDefaultDate: false, defaultDate: '', colorOrder: [], categoryIcons: [] }),
  );
  saveSettings = jest.fn((_partial: Partial<AppSettings>): Observable<void> => of(undefined));
}
