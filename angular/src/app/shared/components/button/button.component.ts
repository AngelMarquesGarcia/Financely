import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-button',
  template: `
    <button [type]="type" [disabled]="disabled" [class]="'btn btn--' + variant">
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  @Input() variant: 'primary' | 'ghost' | 'danger' | 'edit' | 'delete' = 'primary';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
}
