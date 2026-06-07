import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { Account, Category, Envelope } from '@shared/types';
import { EnvelopeFormComponent } from './envelope-form/envelope-form.component';
import { EnvelopesListComponent } from './envelopes-list/envelopes-list.component';

@Component({
  selector: 'app-envelopes',
  imports: [EnvelopeFormComponent, EnvelopesListComponent],
  templateUrl: './envelopes.component.html',
  styleUrl: './envelopes.component.scss',
})
export class EnvelopesComponent implements OnInit {
  private electron = inject(ElectronService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);
  private errors = inject(ErrorReporter);
  private destroyRef = inject(DestroyRef);

  envelopes: Envelope[] = [];
  accounts: Account[] = [];
  categories: Category[] = [];
  editingEnvelope: Envelope | null = null;

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    forkJoin({
      envelopes: this.electron.getAllEnvelopes(),
      accounts: this.electron.getAllAccounts(),
      categories: this.electron.getAllCategories(),
    })
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ envelopes, accounts, categories }) => {
        this.envelopes = envelopes;
        this.accounts = accounts;
        this.categories = categories;
      });
  }

  onEditRequested(envelope: Envelope) {
    this.editingEnvelope = envelope;
  }

  onDeleteRequested(id: number) {
    const target = this.envelopes.find((e) => e.id === id);
    if (!target) return;
    this.confirm
      .confirm({
        title: 'Delete envelope',
        message: `Delete envelope "${target.name}"? Its movements will be reassigned to the account's default envelope.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.deleteEnvelope(id) : of(null))),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result !== null) {
          this.notify.success(`Envelope "${target.name}" deleted.`);
          this.loadAll();
        }
      });
  }

  onSetDefaultRequested(id: number) {
    this.electron
      .setDefaultEnvelope(id)
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadAll());
  }

  onSaved() {
    this.editingEnvelope = null;
    this.loadAll();
  }

  onCancelled() {
    this.editingEnvelope = null;
  }
}
