import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { AmountInputComponent } from '../../../shared/components/amount-input/amount-input.component';
import { Account } from '@shared/types';

@Component({
  selector: 'app-account-form',
  imports: [FormsModule, FormFieldComponent, AmountInputComponent],
  templateUrl: './account-form.component.html',
  styleUrl: './account-form.component.scss',
})
export class AccountFormComponent implements OnChanges {
  @Input() editingAccount: Account | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private destroyRef = inject(DestroyRef);

  name = '';
  description = '';
  startingBalance = 0;
  showErrors = false;

  get isEditing() {
    return this.editingAccount !== null;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['editingAccount']) {
      this.name = this.editingAccount?.name ?? '';
      this.description = this.editingAccount?.description ?? '';
      this.startingBalance = this.editingAccount?.startingBalance ?? 0;
    }
  }

  save() {
    this.showErrors = true;
    if (!this.name.trim()) return;

    if (this.isEditing) {
      this.electron
        .updateAccount({
          id: this.editingAccount!.id,
          name: this.name,
          description: this.description || undefined,
          isDefault: this.editingAccount!.isDefault,
          startingBalance: this.startingBalance,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.saved.emit(),
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    } else {
      this.electron
        .createAccount(this.name, this.description || undefined, this.startingBalance || undefined)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saved.emit();
            this.name = '';
            this.description = '';
            this.startingBalance = 0;
            this.showErrors = false;
          },
          error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
        });
    }
  }

  cancel() {
    this.cancelled.emit();
  }
}
