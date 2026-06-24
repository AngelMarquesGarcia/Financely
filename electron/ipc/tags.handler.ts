import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { tagService } from '../services/tag.service';
import { TagT } from '@shared/types';
import { Tag } from '@shared/domain';

export function registerTagHandlers(): void {
  ipcMain.handle(
    Channels.TAG_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { type: string; name: string; color: string }) =>
      tagService.create(arg.type, arg.name, arg.color),
    ),
  );

  ipcMain.handle(Channels.TAG_GET_ALL, ipcHandle(() => tagService.getAll()));

  ipcMain.handle(
    Channels.TAG_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => tagService.getById(id)),
  );

  ipcMain.handle(
    Channels.TAG_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, tag: TagT) => tagService.update(Tag.from(tag))),
  );

  ipcMain.handle(
    Channels.TAG_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => tagService.delete(id)),
  );

  ipcMain.handle(
    Channels.TAG_ADD_TO_MOVEMENT,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { tagId: number; movementId: number }) =>
      tagService.addToMovement(arg.tagId, arg.movementId),
    ),
  );

  ipcMain.handle(
    Channels.TAG_REMOVE_FROM_MOVEMENT,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { tagId: number; movementId: number }) =>
      tagService.removeFromMovement(arg.tagId, arg.movementId),
    ),
  );

  ipcMain.handle(
    Channels.TAG_GET_FOR_MOVEMENT,
    ipcHandle((_event: IpcMainInvokeEvent, movementId: number) => tagService.getForMovement(movementId)),
  );

  ipcMain.handle(
    Channels.TAG_GET_FOR_MOVEMENTS,
    ipcHandle((_event: IpcMainInvokeEvent, movementIds: number[]) =>
      tagService.getForMovements(movementIds),
    ),
  );
}
