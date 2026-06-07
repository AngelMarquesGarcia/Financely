import { Component, inject } from '@angular/core';
import { DIALOG_DATA } from '../../../core/services/dialog.tokens';
import { DialogRef } from '../../../core/services/dialog-ref';
import { ConfirmRequest } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  protected readonly req = inject(DIALOG_DATA) as ConfirmRequest;
  private readonly ref = inject(DialogRef<boolean>);

  cancel() {
    this.ref.close(false);
  }

  accept() {
    this.ref.close(true);
  }
}
