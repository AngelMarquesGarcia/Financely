import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Account, Envelope } from '@shared/types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-envelopes-list',
  imports: [EmptyStateComponent],
  templateUrl: './envelopes-list.component.html',
  styleUrl: './envelopes-list.component.scss',
})
export class EnvelopesListComponent {
  @Input() envelopes: Envelope[] = [];
  @Input() accounts: Account[] = [];
  @Output() editRequested = new EventEmitter<Envelope>();
  @Output() deleteRequested = new EventEmitter<number>();
  @Output() setDefaultRequested = new EventEmitter<number>();

  accountName(accountId: number | null): string {
    if (accountId === null) return '—';
    return this.accounts.find((a) => a.id === accountId)?.name ?? '—';
  }
}
