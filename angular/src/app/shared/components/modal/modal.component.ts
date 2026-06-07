import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';

/**
 * Template-driven modal for windowed feature components — i.e. "windows" that host
 * a sub-feature (a form, a wizard step, an embedded settings page). Bind `[open]` and
 * keep the template inline; the modal is rendered inside the parent's view.
 *
 * For confirms, alerts, and short-lived dialogs opened imperatively, prefer
 * `DialogService.open(MyComponent)` instead.
 */
@Component({
  selector: 'app-modal',
  imports: [A11yModule],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() title?: string;
  @Output() closed = new EventEmitter<void>();

  private readonly scrollStrategy = inject(Overlay).scrollStrategies.block();

  ngOnChanges(changes: SimpleChanges) {
    if (changes['open']) {
      if (this.open) this.scrollStrategy.enable();
      else this.scrollStrategy.disable();
    }
  }

  ngOnDestroy() {
    this.scrollStrategy.disable();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open) this.closed.emit();
  }

  onBackdropClick() {
    this.closed.emit();
  }
}
