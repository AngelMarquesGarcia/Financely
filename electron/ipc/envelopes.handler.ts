import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import {
  createEnvelope,
  getAllEnvelopes,
  getEnvelopeById,
  updateEnvelope,
  deleteEnvelope,
  setDefaultEnvelope,
} from '../services/envelope.service';
import { Envelope } from '@shared/types';

export function registerEnvelopeHandlers(): void {
  ipcMain.handle(
    Channels.ENVELOPE_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { name: string; accountId: number }) =>
      createEnvelope(arg.name, arg.accountId),
    ),
  );

  ipcMain.handle(Channels.ENVELOPE_GET_ALL, ipcHandle(() => getAllEnvelopes()));

  ipcMain.handle(
    Channels.ENVELOPE_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => getEnvelopeById(id)),
  );

  ipcMain.handle(
    Channels.ENVELOPE_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, envelope: Envelope) => updateEnvelope(envelope)),
  );

  ipcMain.handle(
    Channels.ENVELOPE_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => deleteEnvelope(id)),
  );

  ipcMain.handle(
    Channels.ENVELOPE_SET_DEFAULT,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => setDefaultEnvelope(id)),
  );
}
