import { Routes } from '@angular/router';
import { AppShellComponent } from './app-shell/app-shell';
import { BoardMemberComponent } from './app-shell/board-member/board-member';
import { DashboardComponent } from './app-shell/dashboard/dashboard';
import { SearchComponent } from './app-shell/search/search';
import { ChallengeComponent } from './authentication/challenge/challange';
import { authGuard } from './core/guards/auth.guard.service';
import { clientAccessGuard } from './core/guards/client.access.guard.service';
import { sessionGuard } from './core/guards/session.guard.service';
import { CalendarComponent } from './app-shell/calendar/calendar';
import { UserList } from './app-shell/user/user';
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
            { path: 'dashboard', component: DashboardComponent },
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
            { path: 'user', component: UserList, canActivate: [permissionGuard('MT_User_ViewAll')] },
            { path: 'boardMember', component: BoardMemberComponent, canActivate: [permissionGuard('MT_BoardMembers')] },
            { path: 'calendar', component: CalendarComponent },
            { path: 'search', component: SearchComponent },
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
