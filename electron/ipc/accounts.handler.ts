import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { accountService } from '../services/account.service';
import { AccountT } from '@shared/types';
import { Account } from '@shared/domain';

export function registerAccountHandlers(): void {
  ipcMain.handle(
    Channels.ACCOUNT_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { name: string; description?: string; startingBalance?: number }) =>
      accountService.create(arg.name, arg.description, arg.startingBalance),
    ),
  );

  ipcMain.handle(Channels.ACCOUNT_GET_ALL, ipcHandle(() => accountService.getAll()));

  ipcMain.handle(
    Channels.ACCOUNT_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => accountService.getById(id)),
  );

  ipcMain.handle(
    Channels.ACCOUNT_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, account: AccountT) => accountService.update(Account.from(account))),
  );

  ipcMain.handle(
    Channels.ACCOUNT_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => accountService.delete(id)),
  );

  ipcMain.handle(
    Channels.ACCOUNT_SET_DEFAULT,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => accountService.setDefault(id)),
  );

  ipcMain.handle(Channels.ACCOUNT_GET_STATS, ipcHandle(() => accountService.getStats()));
}
