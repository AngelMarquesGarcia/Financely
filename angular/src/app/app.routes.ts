import { Routes } from '@angular/router';
import { MovementsComponent } from './features/movements/movements.component';
import { CategoriesComponent } from './features/categories/categories.component';
import { AccountsComponent } from './features/accounts/accounts.component';
import { EnvelopesComponent } from './features/envelopes/envelopes.component';
import { TagsComponent } from './features/tags/tags.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: '', redirectTo: 'movements', pathMatch: 'full' },
  { path: 'movements', component: MovementsComponent },
  { path: 'categories', component: CategoriesComponent },
  { path: 'accounts', component: AccountsComponent },
  { path: 'envelopes', component: EnvelopesComponent },
  { path: 'tags', component: TagsComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: 'movements' },
];
