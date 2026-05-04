import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { calculateOperations } from '../services/operations.service';
import { Operator } from '../../shared/types';
import { Channels } from './channels';

export function registerOperationsHandlers(): void {
  ipcMain.handle(
    Channels.RUN_OPERATION,
    (_event: IpcMainInvokeEvent, arg: { n1: number; n2: number; op: string }) =>
      calculateOperations(arg.n1, arg.n2, arg.op as Operator),
  );
}
