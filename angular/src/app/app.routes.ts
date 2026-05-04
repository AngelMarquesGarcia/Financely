import { Routes } from '@angular/router';
import { OperationsComponent } from './features/operations/operations.component';
import { SentencesComponent } from './features/sentences/sentences.component';

export const routes: Routes = [
  { path: 'operations', component: OperationsComponent },
  { path: 'sentences', component: SentencesComponent },
];
