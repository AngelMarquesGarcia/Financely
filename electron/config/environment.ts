import { app } from 'electron';
import { PATHS } from './paths';

export const isLocal = process.argv.includes('--local');
export const isServe = process.argv.includes('--serve');

export function getStartURL(): string {
  return app.isPackaged || isLocal ? `file://${PATHS.renderer}` : 'http://localhost:4200';
}
