import { Component, EventEmitter, Input, Output, TemplateRef, ContentChild } from '@angular/core';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { NgTemplateOutlet } from '@angular/common';
import { ChipComponent } from '../chip/chip.component';
import { PopoverComponent } from '../popover/popover.component';

/**
 * Multi-select picker over a list of entities. Renders selected entities as chips,
 * opens a popover with the remaining options. Each option may show a color dot
 * and/or an emoji (via the `colorFn` / `emojiFn` inputs).
 *
 * Use this for entity pickers (tags, categories, envelopes) where the entities
 * carry visual metadata that a native `<select>` can't render. For plain enum
 * dropdowns (income/expense, text-match condition, etc.), keep the native select.
 *
 * Optional "create new" UI can be projected via `<ng-template #createNew>`.
 */
@Component({
  selector: 'app-entity-select',
  imports: [ChipComponent, PopoverComponent, NgTemplateOutlet],
  templateUrl: './entity-select.component.html',
  styleUrl: './entity-select.component.scss',
})
export class EntitySelectComponent<T extends { id: number }> {
  protected readonly faChevronDown = faChevronDown;

  @Input() items: T[] = [];
  @Input() selectedIds: number[] = [];
  @Output() selectedIdsChange = new EventEmitter<number[]>();

  /** How to derive a label for an item. Required. */
  @Input() labelFn: (item: T) => string = (item) =>
    String((item as { name?: string }).name ?? item.id);
  /** Optional color hex for the chip + popover dot. */
  @Input() colorFn?: (item: T) => string | undefined;
  /** Optional emoji rendered alongside the label. */
  @Input() emojiFn?: (item: T) => string | undefined;
  /** Optional filter applied to the popover list (e.g. "unassigned categories only"). */
  @Input() availableFilter?: (item: T) => boolean;

  @Input() addLabel = 'Add';
  @Input() emptyMessage = 'No more items';

  @ContentChild('createNew') createNewTpl?: TemplateRef<unknown>;

  showAddPopover = false;
  showCreatePopover = false;

  get selectedItems(): T[] {
    return this.selectedIds
      .map((id) => this.items.find((item) => item.id === id))
      .filter((x): x is T => x != null);
  }

  get availableItems(): T[] {
    const notSelected = this.items.filter((item) => !this.selectedIds.includes(item.id));
    return this.availableFilter ? notSelected.filter(this.availableFilter) : notSelected;
  }

  add(id: number) {
    if (!this.selectedIds.includes(id)) {
      this.selectedIdsChange.emit([...this.selectedIds, id]);
    }
    this.showAddPopover = false;
  }

  remove(id: number) {
    this.selectedIdsChange.emit(this.selectedIds.filter((x) => x !== id));
  }

  /** Called by the projected create-new template after a new entity is created. */
  onCreated(id: number) {
    this.showCreatePopover = false;
    this.selectedIdsChange.emit([...this.selectedIds, id]);
  }
}
