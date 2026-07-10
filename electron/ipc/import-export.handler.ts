import { ipcMain, IpcMainInvokeEvent, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { importExportService } from '../services/import-export.service';
import { MovementDraftT, MovementFilter } from '@shared/types';

/** UTF-8 byte-order mark, prepended to exports so Excel detects UTF-8 (avoids mojibake on accents). */
const BOM = String.fromCharCode(0xfeff);

/** Native file picker anchored to the calling window (falls back to a modeless dialog). */
function pickOpenPath(event: IpcMainInvokeEvent, title: string): string | undefined {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.OpenDialogSyncOptions = {
    title,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile'],
  };
  const result = win ? dialog.showOpenDialogSync(win, options) : dialog.showOpenDialogSync(options);
  return result?.[0];
}

function pickSavePath(
  event: IpcMainInvokeEvent,
  title: string,
  defaultName: string,
): string | undefined {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options: Electron.SaveDialogSyncOptions = {
    title,
    defaultPath: defaultName,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  };
  const result = win ? dialog.showSaveDialogSync(win, options) : dialog.showSaveDialogSync(options);
  return result;
}

export function registerImportExportHandlers(): void {
  ipcMain.handle(
    Channels.IMPORT_EXPORT_PREVIEW,
    ipcHandle((event: IpcMainInvokeEvent, arg: { targetAccountId: number }) => {
      const filePath = pickOpenPath(event, 'Import movements from CSV');
      if (!filePath) return null;
      const content = fs.readFileSync(filePath, 'utf8');
      return importExportService.previewImport(content, arg.targetAccountId);
    }),
  );

  ipcMain.handle(
    Channels.IMPORT_EXPORT_COMMIT,
    ipcHandle(
      (_event: IpcMainInvokeEvent, arg: { drafts: MovementDraftT[]; targetAccountId: number }) =>
        importExportService.commitImport(arg.drafts, arg.targetAccountId),
    ),
  );

  ipcMain.handle(
    Channels.IMPORT_EXPORT_EXPORT,
    ipcHandle((event: IpcMainInvokeEvent, filter?: MovementFilter) => {
      // Serialize first so a tentative-in-selection rejection happens before the save dialog opens.
      const csv = importExportService.exportMovements(filter);
      const savePath = pickSavePath(event, 'Export movements to CSV', 'movements.csv');
      if (!savePath) return null;
      // UTF-8 BOM so Excel opens accented text correctly.
      fs.writeFileSync(savePath, BOM + csv, 'utf8');
      return savePath;
    }),
  );
}
