import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatCents, parseMoney } from '../../utils';

/**
 * Money text input. Edits as a decimal string ("22.50"), emits integer cents.
 * On blur, normalizes the displayed string to two decimals.
 *
 * Usage:
 *   <app-amount-input [amountCents]="value" (amountCentsChange)="value = $event" />
 *
 * Setting `amountCents` to `null` (or omitting the binding) keeps the field
 * empty — useful for filter "from/to" inputs where empty means "no bound".
 */
@Component({
  selector: 'app-amount-input',
  imports: [FormsModule],
  template: `
    <input
      type="text"
      inputmode="decimal"
      [class]="inputClass"
      [placeholder]="placeholder"
      [attr.id]="inputId"
      [(ngModel)]="display"
      (ngModelChange)="onTextChange($event)"
      (blur)="onBlur()"
    />
  `,
  styles: [':host { display: inline-block; }'],
})
export class AmountInputComponent {
  @Input() inputClass = 'form__input';
  @Input() placeholder = '0.00';
  @Input() inputId?: string;
  /** Empty input maps to `null` (filter use case). Form use case can pass `0`. */
  @Input() set amountCents(value: number | null | undefined) {
    const normalized = value ?? null;
    // Ignore echoes of our own emission. Parents bind (amountCentsChange)="x = $event",
    // so every keystroke's emitted value flows straight back into this setter. Reformatting
    // `display` here would rewrite what the user is mid-way through typing (e.g. "39" → "3.009").
    // Only react to genuinely external changes (initial value, editing a record, reset).
    if (normalized === this.lastEmitted) return;
    this.lastEmitted = normalized;
    this.display = normalized == null ? '' : formatCents(normalized);
  }
  @Output() amountCentsChange = new EventEmitter<number | null>();

  display = '';
  private lastEmitted: number | null = null;

  onTextChange(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      this.emit(null);
      return;
    }
    try {
      this.emit(parseMoney(trimmed));
    } catch {
      // Invalid intermediate input (e.g. "1." while typing) — don't emit until valid.
    }
  }

  onBlur() {
    if (this.lastEmitted == null) return;
    this.display = formatCents(this.lastEmitted);
  }

  private emit(value: number | null) {
    if (value === this.lastEmitted) return;
    this.lastEmitted = value;
    this.amountCentsChange.emit(value);
  }
}
