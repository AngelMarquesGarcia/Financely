import { Component, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast-host',
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.scss',
})
export class ToastHostComponent {
  protected readonly notify = inject(NotificationService);
}
