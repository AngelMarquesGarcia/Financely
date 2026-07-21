import { Component, Input } from '@angular/core';

/**
 * Form field shell: label + input slot + optional error message.
 * Replaces the repetitive `.form__group > .form__label + (input) + .form__error` triple.
 *
 * Usage:
 *   <app-form-field label="Name" [error]="showErrors && !name.trim() ? 'Name is required.' : null">
 *     <input class="form__input" [(ngModel)]="name" />
 *   </app-form-field>
 */
@Component({
  selector: 'app-form-field',
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
})
export class FormFieldComponent {
  @Input({ required: true }) label!: string;
  @Input() forId?: string;
  /** Truthy strings render as the error message; null/undefined/empty hide it. */
  @Input() error?: string | null;
  /** When true, the label gets a "(optional)" suffix and is muted slightly. */
  @Input() optional = false;
  /** Spans both columns in a 2-col grid. Maps to `.form__group--full`. */
  @Input() full = false;
}
