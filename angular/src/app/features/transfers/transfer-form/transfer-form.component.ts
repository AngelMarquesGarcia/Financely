import { Component, DestroyRef, EventEmitter, inject, Input, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../../core/services/electron.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorTextService } from '../../../core/services/error-text.service';
import { EnvelopeT } from '@shared/types';
import { AmountInputComponent } from '../../../shared/components/amount-input/amount-input.component';

@Component({
  selector: 'app-transfer-form',
  imports: [FormsModule, AmountInputComponent],
  templateUrl: './transfer-form.component.html',
  styleUrl: './transfer-form.component.scss',
})
export class TransferFormComponent {
  @Input() envelopes: EnvelopeT[] = [];
  @Output() created = new EventEmitter<void>();

  private electron = inject(ElectronService);
  private notify = inject(NotificationService);
  private errorText = inject(ErrorTextService);
  private destroyRef = inject(DestroyRef);

  fromEnvelopeId: number | null = null;
  toEnvelopeId: number | null = null;
  amountCents: number | null = null;
  date = this.todayString();
  notes: string | null = null;
  showErrors = false;

  /** Destinations must live in the same account as the source and not be the source itself. */
  get toOptions(): EnvelopeT[] {
    const from = this.envelopes.find((e) => e.id === this.fromEnvelopeId);
    if (!from) return [];
    return this.envelopes.filter((e) => e.accountId === from.accountId && e.id !== from.id);
  }

  onFromChange() {
    if (this.toEnvelopeId != null && !this.toOptions.some((e) => e.id === this.toEnvelopeId)) {
      this.toEnvelopeId = null;
    }
  }

  get isValid(): boolean {
    return (
      this.fromEnvelopeId != null &&
      this.toEnvelopeId != null &&
      this.amountCents != null &&
      this.amountCents > 0 &&
      !!this.date
    );
  }

  save() {
    this.showErrors = true;
    if (!this.isValid) return;
    const date = new Date(this.date + 'T00:00:00');
    this.electron
      .createTransfer(this.fromEnvelopeId!, this.toEnvelopeId!, this.amountCents!, date, this.notes || null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notify.success('Transfer created.');
          this.created.emit();
          this.reset();
        },
        error: (e: Error) => this.notify.error(this.errorText.resolve(e.message)),
      });
  }

  private reset() {
    this.fromEnvelopeId = null;
    this.toEnvelopeId = null;
    this.amountCents = null;
    this.date = this.todayString();
    this.notes = null;
    this.showErrors = false;
  }

  /** Local-timezone YYYY-MM-DD (matches the repository's stored format). */
  private todayString(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
