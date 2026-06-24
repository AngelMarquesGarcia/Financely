import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { movementService } from '../services/movement.service';
import { MovementT, MovementFilter } from '@shared/types';
import { Movement } from '@shared/domain';

export function registerMovementHandlers(): void {
  ipcMain.handle(
    Channels.MOVEMENT_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: Omit<MovementT, 'id'>) =>
      movementService.create(
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
    ipcHandle((_event: IpcMainInvokeEvent, filter?: MovementFilter) => movementService.getAll(filter)),
  );

  ipcMain.handle(
    Channels.MOVEMENT_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => movementService.getById(id)),
  );

  ipcMain.handle(
    Channels.MOVEMENT_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, movement: MovementT) => {
      movementService.update(Movement.from(movement));
    }),
  );

  ipcMain.handle(
    Channels.MOVEMENT_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => movementService.delete(id)),
  );

  ipcMain.handle(
    Channels.MOVEMENT_DELETE_MANY,
    ipcHandle((_event: IpcMainInvokeEvent, ids: number[]) => movementService.deleteMany(ids)),
  );

  ipcMain.handle(
    Channels.MOVEMENT_SUGGEST_NAMES,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { prefix: string; limit?: number }) =>
      movementService.suggestNames(arg.prefix, arg.limit),
    ),
  );
}
