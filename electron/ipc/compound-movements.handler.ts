import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { compoundMovementService } from '../services/compound-movement.service';
import { CompoundMovementT, NewCompoundChild, NewCompoundFields } from '@shared/types';

export function registerCompoundMovementHandlers(): void {
  ipcMain.handle(
    Channels.COMPOUND_CREATE,
    ipcHandle(
      (
        _event: IpcMainInvokeEvent,
        arg: {
          fields: NewCompoundFields;
          existingChildIds: number[];
          newChildren: NewCompoundChild[];
        },
      ) => compoundMovementService.create(arg.fields, arg.existingChildIds, arg.newChildren),
    ),
  );

  ipcMain.handle(
    Channels.COMPOUND_GET_ALL,
    ipcHandle((_event: IpcMainInvokeEvent) => compoundMovementService.getAll()),
  );

  ipcMain.handle(
    Channels.COMPOUND_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => compoundMovementService.getById(id)),
  );

  ipcMain.handle(
    Channels.COMPOUND_GET_CHILDREN,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => compoundMovementService.getChildren(id)),
  );

  ipcMain.handle(
    Channels.COMPOUND_ADD_MEMBER,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { compoundId: number; movementId: number }) =>
      compoundMovementService.addMember(arg.compoundId, arg.movementId),
    ),
  );

  ipcMain.handle(
    Channels.COMPOUND_CREATE_MEMBER,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { compoundId: number; child: NewCompoundChild }) =>
      compoundMovementService.createMember(arg.compoundId, arg.child),
    ),
  );

  ipcMain.handle(
    Channels.COMPOUND_REMOVE_MEMBER,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { compoundId: number; movementId: number }) =>
      compoundMovementService.removeMember(arg.compoundId, arg.movementId),
    ),
  );

  ipcMain.handle(
    Channels.COMPOUND_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, compound: CompoundMovementT) =>
      compoundMovementService.update(compound),
    ),
  );

  ipcMain.handle(
    Channels.COMPOUND_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { id: number; deleteChildren: boolean }) =>
      compoundMovementService.delete(arg.id, arg.deleteChildren),
    ),
  );
}
