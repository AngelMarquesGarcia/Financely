import { Directive, ElementRef, input, output, AfterViewInit, OnDestroy, inject } from '@angular/core';
import Sortable, { SortableOptions } from 'sortablejs';

export interface SortEvent {
  oldIndex: number;
  newIndex: number;
  item: HTMLElement;
}

export interface TransferEvent extends SortEvent {
  from: HTMLElement;
  to: HTMLElement;
}

@Directive({
  selector: '[appSortable]',
  standalone: true,
})
export class SortableDirective implements AfterViewInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  options = input<Partial<SortableOptions>>({});
  group = input<string | Sortable.GroupOptions | undefined>(undefined);
  handle = input<string | undefined>(undefined);
  disabled = input<boolean>(false);

  sorted = output<SortEvent>();
  transferred = output<TransferEvent>();

  private sortable?: Sortable;

  ngAfterViewInit(): void {
    this.sortable = Sortable.create(this.el.nativeElement, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      group: this.group(),
      handle: this.handle(),
      disabled: this.disabled(),
      ...this.options(),
      onEnd: (event) => {
        if (event.oldIndex === undefined || event.newIndex === undefined) return;

        const payload = {
          oldIndex: event.oldIndex,
          newIndex: event.newIndex,
          item: event.item,
        };

        if (event.from !== event.to) {
          this.transferred.emit({ ...payload, from: event.from, to: event.to });
        } else if (event.oldIndex !== event.newIndex) {
          this.sorted.emit(payload);
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.sortable?.destroy();
  }
}
