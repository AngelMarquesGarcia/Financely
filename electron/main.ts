import { DatabaseService } from './repository/database.service';
import { registerMovementHandlers } from './ipc/movements.handler';
import { registerPeriodicMovementHandlers } from './ipc/periodic-movements.handler';
import { registerTransferHandlers } from './ipc/transfers.handler';
import { registerCategoryHandlers } from './ipc/categories.handler';
import { registerAccountHandlers } from './ipc/accounts.handler';
import { registerEnvelopeHandlers } from './ipc/envelopes.handler';
import { registerTagHandlers } from './ipc/tags.handler';
import { registerSettingsHandlers } from './ipc/settings.handler';
import { registerPeriodSummaryHandlers } from './ipc/period-summaries.handler';
import { PATHS } from './config/paths';
import { getStartURL } from './config/environment';

import { app, BrowserWindow } from 'electron';

app.commandLine.appendSwitch('remote-debugging-port', '9223');

const createWindow = () => {
  DatabaseService.getInstance().migrate();

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
  registerMovementHandlers();
  registerPeriodicMovementHandlers();
  registerTransferHandlers();
  registerCategoryHandlers();
  registerAccountHandlers();
  registerEnvelopeHandlers();
  registerTagHandlers();
  registerSettingsHandlers();
  registerPeriodSummaryHandlers();
  createWindow();
});
