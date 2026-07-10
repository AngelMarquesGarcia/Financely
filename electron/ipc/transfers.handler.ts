import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { transferService } from '../services/transfer.service';

export function registerTransferHandlers(): void {
  ipcMain.handle(
    Channels.TRANSFER_CREATE,
    ipcHandle(
      (
        _event: IpcMainInvokeEvent,
        arg: {
          fromEnvelopeId: number;
          toEnvelopeId: number;
          quantityCents: number;
          date: Date;
          notes: string | null;
        },
      ) =>
        // Manual transfers are always user-created (isAuto = false); auto only comes from the redirect.
        transferService.create(
          arg.fromEnvelopeId,
          arg.toEnvelopeId,
          arg.quantityCents,
          arg.date,
          false,
          arg.notes,
        ),
    ),
  );

  ipcMain.handle(
    Channels.TRANSFER_GET_ALL,
    ipcHandle((_event: IpcMainInvokeEvent) => transferService.getAll()),
  );

  ipcMain.handle(
    Channels.TRANSFER_GET_FOR_ENVELOPE,
    ipcHandle((_event: IpcMainInvokeEvent, envelopeId: number) =>
      transferService.getForEnvelope(envelopeId),
    ),
  );

  ipcMain.handle(
    Channels.TRANSFER_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => transferService.delete(id)),
  );
}
