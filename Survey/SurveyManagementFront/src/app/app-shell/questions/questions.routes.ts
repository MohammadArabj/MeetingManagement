import { Routes } from '@angular/router';

export const questionsRoutes: Routes = [
  {
    path: 'list',
    loadComponent: () =>
      import('./question-list/question-list.component').then(m => m.QuestionListComponent)
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./question-ops/question-ops.component').then(m => m.QuestionOpsComponent)
  },
  {
    path: 'edit/:guid',
    loadComponent: () =>
      import('./question-ops/question-ops.component').then(m => m.QuestionOpsComponent)
  },
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  }
];
