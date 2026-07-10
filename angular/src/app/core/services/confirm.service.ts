import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DialogService } from './dialog.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(DialogService);

  confirm(request: ConfirmRequest): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmRequest, boolean>(ConfirmDialogComponent, {
        data: request,
      })
      .afterClosed()
      .pipe(map((result) => result ?? false));
  }
}
