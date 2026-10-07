import { Routes } from '@angular/router';
import { AppShellComponent } from './app-shell/app-shell';
import { ChallengeComponent } from './authentication/challenge/challange';
import { authGuard } from './core/guards/auth.guard.service';
import { clientAccessGuard } from './core/guards/client.access.guard.service';
import { sessionGuard } from './core/guards/session.guard.service';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
    {
        path: '',
        component: AppShellComponent,
        // ✅ نتایج session/clientAccess کش می‌شوند؛ دیگر در هر جابجایی صفحه دو درخواست ارسال نمی‌شود
        canActivate: [authGuard, clientAccessGuard],
        canActivateChild: [sessionGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', loadComponent: () => import('./app-shell/dashboard/dashboard').then(m => m.DashboardComponent) },
            {
                path: 'meetings',
                loadChildren: () =>
                    import('./app-shell/meetings/meetings.routes').then(m => m.meetingsRoutes)
            },
            {
                path: 'resolutions',
                loadChildren: () =>
                    import('./app-shell/resolutions/resolutions.routes').then(m => m.resolutionsRoutes)
            },
            {
                path: 'delegation',
                loadChildren: () =>
                    import('./app-shell/delegation/delegations.routes').then(m => m.delegationRouts)
            },
            {
                path: 'settings',
                canActivate: [permissionGuard('MT_Settings', 'MT_UserRoles', 'MT_PrintTemplates')],
                loadChildren: () => import('./app-shell/settings/settings.routes').then(m => m.settingsRoutes)
            },
            { path: 'user', canActivate: [permissionGuard('MT_User_ViewAll')], loadComponent: () => import('./app-shell/user/user').then(m => m.UserList) },
            { path: 'boardMember', canActivate: [permissionGuard('MT_BoardMembers')], loadComponent: () => import('./app-shell/board-member/board-member').then(m => m.BoardMemberComponent) },
            { path: 'calendar', loadComponent: () => import('./app-shell/calendar/calendar').then(m => m.CalendarComponent) },
            { path: 'search', loadComponent: () => import('./app-shell/search/search').then(m => m.SearchComponent) },
        ]
    },
    {
        path: 'challenge',
        component: ChallengeComponent
    },
   
    {
        path: '**',
        redirectTo: 'dashboard',
        pathMatch: 'full'
    },
];
