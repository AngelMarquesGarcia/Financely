import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Category } from '@shared/types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-categories-list',
  imports: [EmptyStateComponent],
  templateUrl: './categories-list.component.html',
  styleUrl: './categories-list.component.scss',
})
export class CategoriesListComponent {
  @Input() categories: Category[] = [];
  @Output() editRequested = new EventEmitter<Category>();
  @Output() deleteRequested = new EventEmitter<number>();
  @Output() setDefaultRequested = new EventEmitter<number>();
}
