import { ipcMain, IpcMainInvokeEvent, dialog, BrowserWindow } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { DatabaseService } from '../repository/database.service';
import { periodSummaryService } from '../services/period-summary.service';
import { AppError, AppErrorCode } from '@shared/error-codes';

const DB_FILTERS = [{ name: 'SQLite Database', extensions: ['db'] }];

/**
 * Full-database backup / restore, plus the dev-only "wipe" and "seed demo" actions. Restore replaces
 * ALL data (validated first, all-or-nothing). `dropAllTables` / `seedExampleData` are TESTING/DEV ONLY
 * and must never be surfaced as normal user actions.
 */
export function registerDatabaseHandlers(): void {
  ipcMain.handle(
    Channels.DB_BACKUP,
    ipcHandle(async (event: IpcMainInvokeEvent) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const options: Electron.SaveDialogSyncOptions = {
        title: 'Back up database',
        defaultPath: 'financely-backup.db',
        filters: DB_FILTERS,
      };
      const savePath = win ? dialog.showSaveDialogSync(win, options) : dialog.showSaveDialogSync(options);
      if (!savePath) return null;
      try {
        await DatabaseService.getInstance().backup(savePath);
      } catch {
        throw new AppError(AppErrorCode.BACKUP_FAILED);
      }
      return savePath;
    }),
  );

  ipcMain.handle(
    Channels.DB_RESTORE,
    ipcHandle((event: IpcMainInvokeEvent) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const options: Electron.OpenDialogSyncOptions = {
        title: 'Restore database from backup',
        filters: DB_FILTERS,
        properties: ['openFile'],
      };
      const result = win ? dialog.showOpenDialogSync(win, options) : dialog.showOpenDialogSync(options);
      const filePath = result?.[0];
      if (!filePath) return false;
      // Throws RESTORE_INVALID_FILE (an AppError) when the file isn't one of our databases.
      DatabaseService.getInstance().restore(filePath);
      return true;
    }),
  );

  ipcMain.handle(
    Channels.DB_DROP_ALL,
    ipcHandle(() => {
      // Wipe, then recreate an empty schema with the minimal defaults so the app stays functional.
      const db = DatabaseService.getInstance();
      db.dropAllTables();
      db.migrate();
    }),
  );

  ipcMain.handle(
    Channels.DB_SEED_EXAMPLE,
    ipcHandle(() => {
      DatabaseService.getInstance().createExampleData();
      // Demo movements are inserted via raw SQL (no period hooks), so build their summaries here.
      periodSummaryService.backfillPeriodSummaries();
    }),
  );
}
