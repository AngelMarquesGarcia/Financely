import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SortableDirective, SortEvent } from '../../directives/sortable.directive';

@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [FormsModule, SortableDirective],
  templateUrl: './icon-picker.component.html',
  styleUrl: './icon-picker.component.scss',
})
export class IconPickerComponent implements OnChanges {
  @Input() icons: string[] = [];
  @Input() value = '';
  @Input() multiSelect = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() reordered = new EventEmitter<SortEvent>();
  @Output() deleteRequested = new EventEmitter<string[]>();
  @Output() resetRequested = new EventEmitter<void>();
  @Output() iconAdded = new EventEmitter<string>();

  selected = new Set<string>();
  addPopoverOpen = false;
  addInput = '';
  addError = '';

  get selectedCount(): number {
    return this.selected.size;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['icons']) {
      const iconSet = new Set(this.icons);
      const next = new Set<string>();
      for (const s of this.selected) {
        if (iconSet.has(s)) next.add(s);
      }
      this.selected = next;
    }
  }

  onIconClick(icon: string) {
    if (this.multiSelect) {
      const next = new Set(this.selected);
      if (next.has(icon)) next.delete(icon);
      else next.add(icon);
      this.selected = next;
    } else {
      this.valueChange.emit(this.value === icon ? '' : icon);
    }
  }

  onSorted(event: SortEvent) {
    this.reordered.emit(event);
  }

  onDeleteSelected() {
    this.deleteRequested.emit([...this.selected]);
    this.selected = new Set();
  }

  submitAdd() {
    const v = this.addInput.trim();
    if (!v) {
      this.addError = 'Enter an icon.';
      return;
    }
    if ([...new Intl.Segmenter().segment(v)].length !== 1) {
      this.addError = 'One character only.';
      return;
    }
    if (this.icons.includes(v)) {
      this.addError = 'Already in the list.';
      return;
    }
    this.iconAdded.emit(v);
    this.addInput = '';
    this.addError = '';
    this.addPopoverOpen = false;
  }
}
