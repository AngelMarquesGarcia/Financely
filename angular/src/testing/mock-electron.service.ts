import { Injectable } from '@angular/core';
import { of, Observable } from 'rxjs';
import { ElectronService } from '../app/core/services/electron.service';
import { Movement, Category, AppSettings, Account, Envelope, Tag } from '@shared/types';

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
  getAllMovements = jest.fn((): Observable<Movement[]> => of([]));
  getMovementById = jest.fn((_id: number): Observable<Movement | undefined> => of(undefined));
  updateMovement = jest.fn((_movement: Movement): Observable<boolean> => of(true));
  deleteMovement = jest.fn((_id: number): Observable<boolean> => of(true));

  createCategory = jest.fn(
    (
      _name: string,
      _color?: string,
      _emoji?: string,
      _envelopeId?: number | null,
    ): Observable<number> => of(1),
  );
  getAllCategories = jest.fn((): Observable<Category[]> => of([]));
  getCategoryById = jest.fn((_id: number): Observable<Category | undefined> => of(undefined));
  updateCategory = jest.fn((_category: Category): Observable<boolean> => of(true));
  deleteCategory = jest.fn((_id: number): Observable<boolean> => of(true));
  setDefaultCategory = jest.fn((_id: number): Observable<void> => of(undefined));

  createAccount = jest.fn((_name: string, _description?: string): Observable<number> => of(1));
  getAllAccounts = jest.fn((): Observable<Account[]> => of([]));
  getAccountById = jest.fn((_id: number): Observable<Account | undefined> => of(undefined));
  updateAccount = jest.fn((_account: Account): Observable<boolean> => of(true));
  deleteAccount = jest.fn((_id: number): Observable<boolean> => of(true));
  setDefaultAccount = jest.fn((_id: number): Observable<void> => of(undefined));

  createEnvelope = jest.fn((_name: string, _accountId: number): Observable<number> => of(1));
  getAllEnvelopes = jest.fn((): Observable<Envelope[]> => of([]));
  getEnvelopeById = jest.fn((_id: number): Observable<Envelope | undefined> => of(undefined));
  updateEnvelope = jest.fn((_envelope: Envelope): Observable<boolean> => of(true));
  deleteEnvelope = jest.fn((_id: number): Observable<boolean> => of(true));
  setDefaultEnvelope = jest.fn((_id: number): Observable<void> => of(undefined));

  createTag = jest.fn(
    (_type: string, _name: string, _color: string): Observable<number> => of(1),
  );
  getAllTags = jest.fn((): Observable<Tag[]> => of([]));
  getTagById = jest.fn((_id: number): Observable<Tag | undefined> => of(undefined));
  updateTag = jest.fn((_tag: Tag): Observable<boolean> => of(true));
  deleteTag = jest.fn((_id: number): Observable<boolean> => of(true));

  getSettings = jest.fn(
    (): Observable<AppSettings> =>
      of({ useDefaultDate: false, defaultDate: '', colorOrder: [] }),
  );
  saveSettings = jest.fn((_partial: Partial<AppSettings>): Observable<void> => of(undefined));
}
