import { Routes } from '@angular/router';
import { AppShellComponent } from './app-shell/app-shell.component';
import { DashboardComponent } from './app-shell/dashboard/dashboard';
import { ChallengeComponent } from './authentication/challenge/challange';
import { ThankYouComponent } from './app-shell/thank-you/thank-you.component';
import { SurveyAuthComponent } from './authentication/survey-auth/survey-auth';
import { authGuard } from './core/guards/auth.guard.service';
import { clientAccessGuard } from './core/guards/client.access.guard.service';
import { sessionGuard } from './core/guards/session.guard.service';
import { permissionGuard } from './core/guards/permission.guard';
import { surveyTakeGuard } from './core/guards/survey-take.guard';

/** مسیرها و گاردها دقیقاً مطابق سامانه مدیریت جلسات (hash routing) */
export const routes: Routes = [
    {
        path: '',
        component: AppShellComponent,
        // ✅ نتایج session/clientAccess کش می‌شوند؛ دیگر در هر جابجایی صفحه دو درخواست ارسال نمی‌شود
        canActivate: [authGuard, clientAccessGuard],
        canActivateChild: [sessionGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: DashboardComponent },
            {
                path: 'responses',
                loadChildren: () =>
                    import('./app-shell/responses/responses.routes').then(m => m.responsesRoutes)
            },
            {
                path: 'surveys',
                loadChildren: () =>
                    import('./app-shell/surveys/surveys.routes').then(m => m.surveysRoutes)
            },
            {
                path: 'questions',
                loadChildren: () =>
                    import('./app-shell/questions/questions.routes').then(m => m.questionsRoutes)
            },
            {
                path: 'user',
                canActivate: [permissionGuard('SV_AccessControl')],
                loadComponent: () => import('./app-shell/user/user').then(m => m.UserList)
            },
        ]
    },

    // ورود با کلید نظرسنجی (لینک‌های u/k)
    { path: 'survey-auth', component: SurveyAuthComponent },
    // شرکت در نظرسنجی: کاربر واردشده یا (برای نظرسنجی عمومی) ناشناس
    {
        path: 'survey/take/:surveyGuid',
        canActivate: [surveyTakeGuard],
        loadComponent: () =>
            import('./app-shell/responses/take-survey/take-survey.component')
                .then(m => m.TakeSurveyComponent)
    },
    {
        path: 'challenge',
        component: ChallengeComponent
    },
    {
        path: 'thankyou',
        component: ThankYouComponent
    },
    {
        path: '**',
        redirectTo: 'dashboard',
        pathMatch: 'full'
    },
];
