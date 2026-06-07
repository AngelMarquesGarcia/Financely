import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-popover',
  templateUrl: './popover.component.html',
  styleUrl: './popover.component.scss',
})
export class PopoverComponent {
  @Input() open = false;
  @Input() align: 'left' | 'right' = 'left';
  @Input() width = 220;
  @Input() showArrow = true;
  @Output() backdropClick = new EventEmitter<void>();
}
