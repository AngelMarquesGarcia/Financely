import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { envelopeService } from '../services/envelope.service';
import { EnvelopeT } from '@shared/types';
import { Envelope } from '@shared/domain';

export function registerEnvelopeHandlers(): void {
  ipcMain.handle(
    Channels.ENVELOPE_CREATE,
    ipcHandle(
      (
        _event: IpcMainInvokeEvent,
        arg: {
          name: string;
          accountId: number;
          startingBalance?: number;
          budgetCents?: number | null;
          maxSavingsCents?: number | null;
          overflowsTo?: number | null;
        },
      ) =>
        envelopeService.create(
          arg.name,
          arg.accountId,
          arg.startingBalance,
          arg.budgetCents,
          arg.maxSavingsCents,
          arg.overflowsTo,
        ),
    ),
  );

  ipcMain.handle(
    Channels.ENVELOPE_GET_ALL,
    ipcHandle(() => envelopeService.getAll()),
  );

  ipcMain.handle(
    Channels.ENVELOPE_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => envelopeService.getById(id)),
  );

  ipcMain.handle(
    Channels.ENVELOPE_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, envelope: EnvelopeT) =>
      envelopeService.update(Envelope.from(envelope)),
    ),
  );

  ipcMain.handle(
    Channels.ENVELOPE_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => envelopeService.delete(id)),
  );

  ipcMain.handle(
    Channels.ENVELOPE_SET_DEFAULT,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => envelopeService.setDefault(id)),
  );
}
