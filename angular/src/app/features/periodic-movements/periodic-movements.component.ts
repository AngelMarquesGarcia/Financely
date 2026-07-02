import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ElectronService } from '../../core/services/electron.service';
import { ErrorReporter } from '../../core/services/error-reporter.service';
import { AccountT, CategoryT, EnvelopeT, PeriodicMovementT } from '@shared/types';
import { PeriodicMovementsListComponent } from './periodic-movements-list/periodic-movements-list.component';

@Component({
  selector: 'app-periodic-movements',
  imports: [PeriodicMovementsListComponent],
  templateUrl: './periodic-movements.component.html',
  styleUrl: './periodic-movements.component.scss',
})
export class PeriodicMovementsComponent implements OnInit {
  private electron = inject(ElectronService);
  private errors = inject(ErrorReporter);
  private destroyRef = inject(DestroyRef);

  templates: PeriodicMovementT[] = [];
  accounts: AccountT[] = [];
  categories: CategoryT[] = [];
  envelopes: EnvelopeT[] = [];

  ngOnInit() {
    forkJoin({
      accounts: this.electron.getAllAccounts(),
      categories: this.electron.getAllCategories(),
      envelopes: this.electron.getAllEnvelopes(),
    })
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ accounts, categories, envelopes }) => {
        this.accounts = accounts;
        this.categories = categories;
        this.envelopes = envelopes;
      });
    this.loadTemplates();
  }

  loadTemplates() {
    this.electron
      .getAllPeriodicMovements()
      .pipe(this.errors.toast(), takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => (this.templates = list));
  }
}
