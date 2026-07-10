import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SortableDirective, SortEvent } from '../../directives/sortable.directive';

@Component({
  selector: 'app-color-swatches',
  standalone: true,
  imports: [FormsModule, SortableDirective],
  templateUrl: './color-swatches.component.html',
  styleUrl: './color-swatches.component.scss',
})
export class ColorSwatchesComponent implements OnChanges {
  @Input() colors: string[] = [];
  @Input() value = '';
  @Input() multiSelect = false;

  @Output() valueChange = new EventEmitter<string>();
  @Output() reordered = new EventEmitter<SortEvent>();
  @Output() colorAdded = new EventEmitter<string>();
  @Output() deleteRequested = new EventEmitter<string[]>();
  @Output() resetRequested = new EventEmitter<void>();

  selected = new Set<string>();
  addOpen = false;
  addValue = '#3b82f6';

  get selectedCount(): number {
    return this.selected.size;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['colors']) {
      const colorSet = new Set(this.colors);
      const next = new Set<string>();
      for (const s of this.selected) {
        if (colorSet.has(s)) next.add(s);
      }
      this.selected = next;
    }
  }

  onSwatchClick(c: string) {
    if (this.multiSelect) {
      const next = new Set(this.selected);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      this.selected = next;
    } else {
      this.valueChange.emit(c);
    }
  }

  onSorted(event: SortEvent) {
    this.reordered.emit(event);
  }

  submitAdd() {
    if (!this.addValue || this.colors.includes(this.addValue)) return;
    this.colorAdded.emit(this.addValue);
    this.addOpen = false;
  }

  onDeleteSelected() {
    this.deleteRequested.emit([...this.selected]);
    this.selected = new Set();
  }
}
