import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { EnvelopeT, TransferT } from '@shared/types';
import { TransferFormComponent } from './transfer-form/transfer-form.component';
import { TransfersListComponent } from './transfers-list/transfers-list.component';

@Component({
  selector: 'app-transfers',
  imports: [TransferFormComponent, TransfersListComponent],
  templateUrl: './transfers.component.html',
  styleUrl: './transfers.component.scss',
})
export class TransfersComponent implements OnInit {
  private electron = inject(ElectronService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);
  private errors = inject(ErrorReporter);
  private destroyRef = inject(DestroyRef);

  transfers: TransferT[] = [];
  envelopes: EnvelopeT[] = [];

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    forkJoin({
      transfers: this.electron.getAllTransfers(),
      envelopes: this.electron.getAllEnvelopes(),
    })
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ transfers, envelopes }) => {
        this.transfers = transfers;
        this.envelopes = envelopes;
      });
  }

  onCreated() {
    this.loadAll();
  }

  onDeleteRequested(id: number) {
    const target = this.transfers.find((t) => t.id === id);
    if (!target) return;
    this.confirm
      .confirm({
        title: 'Delete transfer',
        message: "Delete this transfer? Both envelopes' balances will be recalculated.",
        confirmLabel: 'Delete',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.deleteTransfer(id) : of(null))),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result !== null) {
          this.notify.success('Transfer deleted.');
          this.loadAll();
        }
      });
  }
}
