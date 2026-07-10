import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap, of } from 'rxjs';
import {
  faArrowDown,
  faArrowUp,
  faBoxArchive,
  faScaleBalanced,
} from '@fortawesome/free-solid-svg-icons';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { AccountT, AccountStats } from '@shared/types';
import { AccountFormComponent } from './account-form/account-form.component';
import { AccountsListComponent } from './accounts-list/accounts-list.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

@Component({
  selector: 'app-accounts',
  imports: [FormsModule, AccountFormComponent, AccountsListComponent, StatCardComponent, MoneyPipe],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.scss',
})
export class AccountsComponent implements OnInit {
  protected readonly faArrowUp = faArrowUp;
  protected readonly faArrowDown = faArrowDown;
  protected readonly faScaleBalanced = faScaleBalanced;
  protected readonly faBoxArchive = faBoxArchive;

  private electron = inject(ElectronService);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);
  private errors = inject(ErrorReporter);
  private destroyRef = inject(DestroyRef);

  accounts: AccountT[] = [];
  stats: AccountStats = {
    totalIncomeCents: 0,
    totalExpenseCents: 0,
    totalIncomeWithoutAnomaliesCents: 0,
    totalExpenseWithoutAnomaliesCents: 0,
    balanceCents: 0,
    envelopeCount: 0,
  };
  editingAccount: AccountT | null = null;
  /** When false (default), the income/expense tiles exclude anomalous movements. Balance never does. */
  showAnomalies = false;

  get displayIncomeCents(): number {
    return this.showAnomalies
      ? this.stats.totalIncomeCents
      : this.stats.totalIncomeWithoutAnomaliesCents;
  }

  get displayExpenseCents(): number {
    return this.showAnomalies
      ? this.stats.totalExpenseCents
      : this.stats.totalExpenseWithoutAnomaliesCents;
  }

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    forkJoin({
      accounts: this.electron.getAllAccounts(),
      stats: this.electron.getAccountStats(),
    })
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ accounts, stats }) => {
        this.accounts = accounts;
        this.stats = stats;
      });
  }

  onEditRequested(account: AccountT) {
    this.editingAccount = account;
  }

  onDeleteRequested(id: number) {
    const target = this.accounts.find((a) => a.id === id);
    if (!target) return;
    this.confirm
      .confirm({
        title: 'Delete account',
        message: `Delete account "${target.name}"? All its envelopes and their movements will be permanently deleted.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .pipe(
        switchMap((ok) => (ok ? this.electron.deleteAccount(id) : of(null))),
        this.errors.toast(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result !== null) {
          this.notify.success(`Account "${target.name}" deleted.`);
          this.loadAll();
        }
      });
  }

  onSetDefaultRequested(id: number) {
    this.electron
      .setDefaultAccount(id)
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadAll());
  }

  onSaved() {
    this.editingAccount = null;
    this.loadAll();
  }

  onCancelled() {
    this.editingAccount = null;
  }
}
