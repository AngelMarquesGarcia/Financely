import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { periodSummaryService } from '../services/period-summary.service';
import { PeriodT, PeriodSummaryT } from '@shared/types';
import { Period, PeriodSummary } from '@shared/domain';

export function registerPeriodSummaryHandlers(): void {
  ipcMain.handle(
    Channels.PERIOD_SUMMARY_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, period: PeriodT) =>
      periodSummaryService.create(Period.from(period)),
    ),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_UPSERT,
    ipcHandle((_event: IpcMainInvokeEvent, summary: PeriodSummaryT) =>
      periodSummaryService.upsert(summary),
    ),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_GET_ALL,
    ipcHandle(() => periodSummaryService.getAll()),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_GET_BY_PERIOD,
    ipcHandle((_event: IpcMainInvokeEvent, period: PeriodT) =>
      periodSummaryService.getByPeriod(Period.from(period)),
    ),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, summary: PeriodSummaryT) =>
      periodSummaryService.update(PeriodSummary.from(summary)),
    ),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, period: PeriodT) =>
      periodSummaryService.delete(Period.from(period)),
    ),
  );
}
