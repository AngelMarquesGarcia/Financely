import { contextBridge, ipcRenderer } from 'electron';
import { Channels } from './ipc/channels';

contextBridge.exposeInMainWorld('api', {
  addOne: () => ipcRenderer.invoke(Channels.ADD_ONE),
});

contextBridge.exposeInMainWorld('ops', {
  runOperation: (n1: number, n2: number, op: string) =>
    ipcRenderer.invoke(Channels.RUN_OPERATION, { n1, n2, op }),
});

contextBridge.exposeInMainWorld('sents', {
  count: (sent: string) => ipcRenderer.invoke(Channels.COUNT_WORDS, sent),
});
