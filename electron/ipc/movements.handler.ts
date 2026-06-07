import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import {
  createMovement,
  getAllMovements,
  getMovementById,
  updateMovement,
  deleteMovement,
  deleteManyMovements,
  suggestMovementNames,
} from '../services/movement.service';
import { Movement, MovementFilter } from '@shared/types';

export function registerMovementHandlers(): void {
  ipcMain.handle(
    Channels.MOVEMENT_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: Omit<Movement, 'id'>) =>
      createMovement(
        arg.name,
        arg.concept,
        arg.quantityCents,
        arg.isPositive,
        arg.date,
        arg.categoryId,
        arg.envelopeId,
        arg.additionalNotes,
      ),
    ),
  );

  ipcMain.handle(
    Channels.MOVEMENT_GET_ALL,
    ipcHandle((_event: IpcMainInvokeEvent, filter?: MovementFilter) => getAllMovements(filter)),
  );

  ipcMain.handle(
    Channels.MOVEMENT_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => getMovementById(id)),
  );

  ipcMain.handle(
    Channels.MOVEMENT_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, movement: Movement) => updateMovement(movement)),
  );

  ipcMain.handle(
    Channels.MOVEMENT_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => deleteMovement(id)),
  );

  ipcMain.handle(
    Channels.MOVEMENT_DELETE_MANY,
    ipcHandle((_event: IpcMainInvokeEvent, ids: number[]) => deleteManyMovements(ids)),
  );

  ipcMain.handle(
    Channels.MOVEMENT_SUGGEST_NAMES,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { prefix: string; limit?: number }) =>
      suggestMovementNames(arg.prefix, arg.limit),
    ),
  );
}
