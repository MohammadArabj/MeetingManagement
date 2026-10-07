import { Routes } from '@angular/router';
import { AppShellComponent } from './app-shell/app-shell.component';
import { DashboardComponent } from './app-shell/dashboard/dashboard';
import { ChallengeComponent } from './authentication/challenge/challange';
import { ThankYouComponent } from './app-shell/thank-you/thank-you.component';
import { UserList } from './app-shell/user/user';
import { authGuard } from './core/guards/auth.guard.service';
import { SurveyAuthComponent } from './authentication/survey-auth/survey-auth';
import { surveyAuthGuard } from './core/guards/survey-auth.guard';

export const routes: Routes = [
    // ─── Shell داخلی (نیاز به لاگین کامل) ──────────────────────────────────
    {
        path: '',
        component: AppShellComponent,
        canActivate: [authGuard],
        // runGuardsAndResolvers: 'always' حذف شد.
        // این گزینه باعث می‌شد sessionGuard/clientAccessGuard در هر navigation
        // داخل شل (نه فقط ورود اولیه) دوباره اجرا بشن و دو درخواست HTTP اضافه
        // به SSO بزنن — همین باعث می‌شد یک لگ لحظه‌ای در کش سمت SSO
        // (که خودتون با IMemoryCache/ConcurrentDictionary پیاده‌سازی کردید)
        // کاربر رو وسط کار هم بیرون بندازه، نه فقط لحظه‌ی لاگین.
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
            { path: 'user', component: UserList },
        ]
    },

    {
        path: 'survey-auth',
        component: SurveyAuthComponent,
    },
    {
        path: 'survey/take/:surveyGuid',
        canActivate: [surveyAuthGuard],
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