import { Routes } from '@angular/router';

export const responsesRoutes: Routes = [
  {
    path: 'list/:surveyGuid',
    loadComponent: () =>
      import('./response-list/response-list.component').then(m => m.ResponseListComponent)
  },
  {
    path: 'detail/:id',
    loadComponent: () =>
      import('./response-detail/response-detail.component').then(m => m.ResponseDetailComponent)
  },
  {
    path: 'take/:surveyGuid',
    loadComponent: () =>
      import('./take-survey/take-survey.component').then(m => m.TakeSurveyComponent)
  },
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  }
];
