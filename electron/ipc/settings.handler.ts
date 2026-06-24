import { ipcMain } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { settingsService } from '../services/settings.service';
import { AppSettings } from '@shared/types';

export function registerSettingsHandlers(): void {
  ipcMain.handle(Channels.SETTINGS_GET, ipcHandle(() => settingsService.getAll()));

  ipcMain.handle(
    Channels.SETTINGS_SET,
    ipcHandle((_event, partial: Partial<AppSettings>) => settingsService.save(partial)),
  );
}
