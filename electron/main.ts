import { DatabaseService } from './services/database.service';
import { registerApiHandlers } from './ipc/api.handler';
import { registerOperationsHandlers } from './ipc/operations.handler';
import { registerSentencesHandlers } from './ipc/sentences.handler';
import { PATHS } from './config/paths';
import { getStartURL } from './config/environment';

import { app, BrowserWindow } from 'electron';

app.commandLine.appendSwitch('remote-debugging-port', '9223');

const db = new DatabaseService();

const createWindow = () => {
  db.migrate();

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: PATHS.preload,
    },
  });

  win.loadURL(getStartURL());
};

app.whenReady().then(() => {
  registerApiHandlers();
  registerOperationsHandlers();
  registerSentencesHandlers();
  createWindow();
});
