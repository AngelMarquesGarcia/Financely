import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import {
  createPeriodSummary,
  upsertPeriodSummary,
  getAllPeriodSummaries,
  getPeriodSummaryByPeriod,
  updatePeriodSummary,
  deletePeriodSummary,
} from '../services/period-summary.service';
import { Period, PeriodSummary } from '@shared/types';

export function registerPeriodSummaryHandlers(): void {
  ipcMain.handle(
    Channels.PERIOD_SUMMARY_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, summary: Omit<PeriodSummary, 'id'>) =>
      createPeriodSummary(summary),
    ),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_UPSERT,
    ipcHandle((_event: IpcMainInvokeEvent, summary: Omit<PeriodSummary, 'id'>) =>
      upsertPeriodSummary(summary),
    ),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_GET_ALL,
    ipcHandle(() => getAllPeriodSummaries()),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_GET_BY_PERIOD,
    ipcHandle(
      (
        _event: IpcMainInvokeEvent,
        arg: { accountId: number; envelopeId: number | null; year: number; month: number },
      ) =>
        getPeriodSummaryByPeriod({
          accountId: arg.accountId,
          envelopeId: arg.envelopeId,
          year: arg.year,
          month: arg.month,
        }),
    ),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, summary: PeriodSummary) =>
      updatePeriodSummary(summary),
    ),
  );

  ipcMain.handle(
    Channels.PERIOD_SUMMARY_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, period: Period) => deletePeriodSummary(period)),
  );
}
