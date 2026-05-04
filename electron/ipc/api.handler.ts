import { ipcMain } from 'electron';
import { addOne } from '../services/api.service';
import { Channels } from './channels';

export function registerApiHandlers(): void {
  ipcMain.handle(Channels.ADD_ONE, () => addOne());
}
