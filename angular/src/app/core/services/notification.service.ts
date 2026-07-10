import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
}

const AUTO_DISMISS_MS = 5000;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  readonly notifications = signal<Notification[]>([]);

  success(message: string) {
    this.push('success', message);
  }

  error(message: string) {
    this.push('error', message);
  }

  info(message: string) {
    this.push('info', message);
  }

  dismiss(id: number) {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }

  private push(type: NotificationType, message: string) {
    const id = this.nextId++;
    this.notifications.update((list) => [...list, { id, type, message }]);
    setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS);
  }
}
