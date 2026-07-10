import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { categoryService } from '../services/category.service';
import { CategoryT } from '@shared/types';
import { Category } from '@shared/domain';

export function registerCategoryHandlers(): void {
  ipcMain.handle(
    Channels.CATEGORY_CREATE,
    ipcHandle(
      (
        _event: IpcMainInvokeEvent,
        arg: { name: string; color?: string; emoji?: string; envelopeId?: number | null },
      ) => categoryService.create(arg.name, arg.color, arg.emoji, arg.envelopeId),
    ),
  );

  ipcMain.handle(
    Channels.CATEGORY_GET_ALL,
    ipcHandle(() => categoryService.getAll()),
  );

  ipcMain.handle(
    Channels.CATEGORY_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => categoryService.getById(id)),
  );

  ipcMain.handle(
    Channels.CATEGORY_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, category: CategoryT) =>
      categoryService.update(Category.from(category)),
    ),
  );

  ipcMain.handle(
    Channels.CATEGORY_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => categoryService.delete(id)),
  );

  ipcMain.handle(
    Channels.CATEGORY_SET_DEFAULT,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => categoryService.setDefault(id)),
  );
}
