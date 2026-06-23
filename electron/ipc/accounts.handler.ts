import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import {
  createAccount,
  getAllAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  setDefaultAccount,
  getAccountStats,
} from '../services/account.service';
import { Account } from '@shared/types';

export function registerAccountHandlers(): void {
  ipcMain.handle(
    Channels.ACCOUNT_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { name: string; description?: string; startingBalance?: number }) =>
      createAccount(arg.name, arg.description, arg.startingBalance),
    ),
  );

  ipcMain.handle(Channels.ACCOUNT_GET_ALL, ipcHandle(() => getAllAccounts()));

  ipcMain.handle(
    Channels.ACCOUNT_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => getAccountById(id)),
  );

  ipcMain.handle(
    Channels.ACCOUNT_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, account: Account) => updateAccount(account)),
  );

  ipcMain.handle(
    Channels.ACCOUNT_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => deleteAccount(id)),
  );

  ipcMain.handle(
    Channels.ACCOUNT_SET_DEFAULT,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => setDefaultAccount(id)),
  );

  ipcMain.handle(Channels.ACCOUNT_GET_STATS, ipcHandle(() => getAccountStats()));
}
