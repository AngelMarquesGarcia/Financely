import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA } from '../../../core/services/dialog.tokens';
import { DialogRef } from '../../../core/services/dialog-ref';

export type CompoundDeleteData = { name: string; childCount: number };
export type CompoundDeleteResult = { deleteChildren: boolean };

/** Confirms deleting a compound, with the D16 "also delete the member movements" choice (default on). */
@Component({
  selector: 'app-compound-delete-dialog',
  imports: [FormsModule],
  templateUrl: './compound-delete-dialog.component.html',
  styleUrl: './compound-delete-dialog.component.scss',
})
export class CompoundDeleteDialogComponent {
  protected readonly data = inject<CompoundDeleteData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<CompoundDeleteResult>);

  protected deleteChildren = true;

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    this.dialogRef.close({ deleteChildren: this.deleteChildren });
  }
}
