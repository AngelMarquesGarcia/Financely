import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AccountT } from '@shared/types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-accounts-list',
  imports: [EmptyStateComponent],
  templateUrl: './accounts-list.component.html',
  styleUrl: './accounts-list.component.scss',
})
export class AccountsListComponent {
  @Input() accounts: AccountT[] = [];
  @Output() editRequested = new EventEmitter<AccountT>();
  @Output() deleteRequested = new EventEmitter<number>();
  @Output() setDefaultRequested = new EventEmitter<number>();
}
