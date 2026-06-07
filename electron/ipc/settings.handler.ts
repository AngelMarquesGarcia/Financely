import { ipcMain } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { getAllSettings, saveSettings } from '../services/settings.service';
import { AppSettings } from '@shared/types';

export function registerSettingsHandlers(): void {
  ipcMain.handle(Channels.SETTINGS_GET, ipcHandle(() => getAllSettings()));

  ipcMain.handle(
    Channels.SETTINGS_SET,
    ipcHandle((_event, partial: Partial<AppSettings>) => saveSettings(partial)),
  );
}
