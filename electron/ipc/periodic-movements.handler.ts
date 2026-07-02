import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Channels } from './channels';
import { ipcHandle } from './ipc-utils';
import { periodicMovementService } from '../services/periodic-movement.service';
import { PeriodicMovementT } from '@shared/types';

type NewTemplate = Omit<
  PeriodicMovementT,
  'id' | 'active' | 'lastCreatedYear' | 'lastCreatedMonth' | 'startYear' | 'startMonth'
>;

export function registerPeriodicMovementHandlers(): void {
  ipcMain.handle(
    Channels.PERIODIC_CREATE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { template: NewTemplate; tagIds: number[] }) =>
      periodicMovementService.create(arg.template, arg.tagIds),
    ),
  );

  ipcMain.handle(
    Channels.PERIODIC_GET_ALL,
    ipcHandle((_event: IpcMainInvokeEvent) => periodicMovementService.getAll()),
  );

  ipcMain.handle(
    Channels.PERIODIC_GET_BY_ID,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => periodicMovementService.getById(id)),
  );

  ipcMain.handle(
    Channels.PERIODIC_GET_TAGS,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) =>
      periodicMovementService.getTagsForPeriodicMovement(id),
    ),
  );

  ipcMain.handle(
    Channels.PERIODIC_UPDATE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { template: PeriodicMovementT; tagIds: number[] }) =>
      periodicMovementService.update(arg.template, arg.tagIds),
    ),
  );

  ipcMain.handle(
    Channels.PERIODIC_DELETE,
    ipcHandle((_event: IpcMainInvokeEvent, id: number) => periodicMovementService.delete(id)),
  );

  ipcMain.handle(
    Channels.PERIODIC_SET_ACTIVE,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { id: number; active: boolean }) =>
      periodicMovementService.setActive(arg.id, arg.active),
    ),
  );

  ipcMain.handle(
    Channels.PERIODIC_RUN_DUE,
    ipcHandle((_event: IpcMainInvokeEvent) => periodicMovementService.generateDueForAll()),
  );

  ipcMain.handle(
    Channels.PERIODIC_INSTANTIATE_CURRENT,
    ipcHandle(
      (_event: IpcMainInvokeEvent, arg: { id: number; date?: Date; amountCents?: number }) =>
        periodicMovementService.instantiateCurrentMonthEarly(arg.id, arg.date, arg.amountCents),
    ),
  );

  ipcMain.handle(
    Channels.PERIODIC_CREATE_ADDITIONAL,
    ipcHandle((_event: IpcMainInvokeEvent, arg: { id: number; date: Date; amountCents?: number }) =>
      periodicMovementService.createAdditionalInstance(arg.id, arg.date, arg.amountCents),
    ),
  );
}
