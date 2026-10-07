import { Routes } from '@angular/router';

export const surveysRoutes: Routes = [
  {
    path: 'list',
    loadComponent: () =>
      import('./survey-list/survey-list.component').then(m => m.SurveyListComponent)
  },
  {
    path: 'my',
    loadComponent: () =>
      import('./my-surveys/my-surveys.component').then(m => m.MySurveysComponent)
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./survey-wizard/survey-wizard.component').then(m => m.SurveyWizardComponent)
  },
  {
    path: 'edit/:guid',
    loadComponent: () =>
      import('./survey-wizard/survey-wizard.component').then(m => m.SurveyWizardComponent)
  },
  {
    path: 'statistics/:guid',
    loadComponent: () =>
      import('./survey-statistics/survey-statistics.component').then(m => m.SurveyStatisticsComponent)
  },
  {
    path: '',
    redirectTo: 'list',
    pathMatch: 'full'
  }
];