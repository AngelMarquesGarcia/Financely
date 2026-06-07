import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  setDefaultCategory,
} from '../services/category.service';
import { Category } from '@shared/types';

export function registerCategoryHandlers(): void {
  ipcMain.handle(
    Channels.CATEGORY_CREATE,
    ipcHandle(
      (
        _event: IpcMainInvokeEvent,
        arg: { name: string; color?: string; emoji?: string; envelopeId?: number | null },
      ) => createCategory(arg.name, arg.color, arg.emoji, arg.envelopeId),
    ),
  );

  ipcMain.handle(Channels.CATEGORY_GET_ALL, ipcHandle(() => getAllCategories()));

  ipcMain.handle(
    Channels.CATEGORY_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => getCategoryById(id)),
  );

  ipcMain.handle(
    Channels.CATEGORY_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, category: Category) => updateCategory(category)),
  );

  ipcMain.handle(
    Channels.CATEGORY_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => deleteCategory(id)),
  );

  ipcMain.handle(
    Channels.CATEGORY_SET_DEFAULT,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => setDefaultCategory(id)),
  );
}
