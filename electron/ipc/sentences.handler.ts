import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { countWordsInSentence } from '../services/sentences.service';
import { Channels } from './channels';

export function registerSentencesHandlers(): void {
  ipcMain.handle(Channels.COUNT_WORDS, (_event: IpcMainInvokeEvent, sent: string) =>
    countWordsInSentence(sent),
  );
}
