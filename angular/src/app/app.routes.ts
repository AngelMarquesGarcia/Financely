import { Routes } from '@angular/router';
import { MovementsComponent } from './features/movements/movements.component';
import { PeriodicMovementsComponent } from './features/periodic-movements/periodic-movements.component';
import { CategoriesComponent } from './features/categories/categories.component';
import { AccountsComponent } from './features/accounts/accounts.component';
import { EnvelopesComponent } from './features/envelopes/envelopes.component';
import { TagsComponent } from './features/tags/tags.component';
import { TransfersComponent } from './features/transfers/transfers.component';
import { SettingsComponent } from './features/settings/settings.component';
import { MonthOverviewComponent } from './features/month-overview/month-overview.component';

export const routes: Routes = [
  { path: '', redirectTo: 'movements', pathMatch: 'full' },
  { path: 'movements', component: MovementsComponent },
  { path: 'periodic-movements', component: PeriodicMovementsComponent },
  { path: 'categories', component: CategoriesComponent },
  { path: 'accounts', component: AccountsComponent },
  { path: 'envelopes', component: EnvelopesComponent },
  { path: 'transfers', component: TransfersComponent },
  { path: 'tags', component: TagsComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'month-overview', component: MonthOverviewComponent },
  { path: '**', redirectTo: 'movements' },
];
