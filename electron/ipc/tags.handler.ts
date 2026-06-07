import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import {
  createTag,
  getAllTags,
  getTagById,
  updateTag,
  deleteTag,
  addTagToMovement,
  removeTagFromMovement,
  getTagsForMovement,
  getTagsForMovements,
} from '../services/tag.service';
import { Tag } from '@shared/types';

export function registerTagHandlers(): void {
  ipcMain.handle(
    Channels.TAG_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { type: string; name: string; color: string }) =>
      createTag(arg.type, arg.name, arg.color),
    ),
  );

  ipcMain.handle(Channels.TAG_GET_ALL, ipcHandle(() => getAllTags()));

  ipcMain.handle(
    Channels.TAG_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => getTagById(id)),
  );

  ipcMain.handle(
    Channels.TAG_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, tag: Tag) => updateTag(tag)),
  );

  ipcMain.handle(
    Channels.TAG_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => deleteTag(id)),
  );

  ipcMain.handle(
    Channels.TAG_ADD_TO_MOVEMENT,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { tagId: number; movementId: number }) =>
      addTagToMovement(arg.tagId, arg.movementId),
    ),
  );

  ipcMain.handle(
    Channels.TAG_REMOVE_FROM_MOVEMENT,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { tagId: number; movementId: number }) =>
      removeTagFromMovement(arg.tagId, arg.movementId),
    ),
  );

  ipcMain.handle(
    Channels.TAG_GET_FOR_MOVEMENT,
    ipcHandle((_event: IpcMainInvokeEvent, movementId: number) => getTagsForMovement(movementId)),
  );

  ipcMain.handle(
    Channels.TAG_GET_FOR_MOVEMENTS,
    ipcHandle((_event: IpcMainInvokeEvent, movementIds: number[]) =>
      getTagsForMovements(movementIds),
    ),
  );
}
