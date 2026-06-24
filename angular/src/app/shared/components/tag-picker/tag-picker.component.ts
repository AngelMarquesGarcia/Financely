import { Component, EventEmitter, Input, Output } from '@angular/core';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { TagT } from '@shared/types';
import { TagFormComponent } from '../../../features/tags/tag-form/tag-form.component';
import { ChipComponent } from '../chip/chip.component';
import { PopoverComponent } from '../popover/popover.component';
import { EntitySelectComponent } from '../entity-select/entity-select.component';

@Component({
  selector: 'app-tag-picker',
  imports: [TagFormComponent, ChipComponent, PopoverComponent, EntitySelectComponent],
  templateUrl: './tag-picker.component.html',
  styleUrl: './tag-picker.component.scss',
})
export class TagPickerComponent {
  protected readonly faPlus = faPlus;
  @Input() tags: TagT[] = [];
  @Input() selectedTagIds: number[] = [];
  @Output() selectedTagIdsChange = new EventEmitter<number[]>();
  @Input() allowCreate = true;
  @Output() tagCreated = new EventEmitter<number>();

  showTagForm = false;

  readonly tagLabel = (t: TagT) => t.name;
  readonly tagColor = (t: TagT) => t.color;

  get existingTypes(): string[] {
    return [...new Set(this.tags.map((t) => t.type))];
  }

  onSelectedChange(ids: number[]) {
    this.selectedTagIdsChange.emit(ids);
  }

  onTagFormSaved(newId: number | null) {
    this.showTagForm = false;
    if (newId !== null) {
      this.selectedTagIdsChange.emit([...this.selectedTagIds, newId]);
      this.tagCreated.emit(newId);
    }
  }
}
