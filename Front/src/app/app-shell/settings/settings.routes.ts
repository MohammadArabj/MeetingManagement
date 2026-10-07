import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { SETTINGS_NAV } from './settings-nav';
import { permissionGuard } from '../../core/guards/permission.guard';
import { SettingsShellComponent } from './shell/settings-shell.component';

/**
 * تنظیمات سامانه (lazy)
 *   general / meetings / board : تنظیمات کلیدی به‌صورت فرم
 *   notifications              : رویدادها، کانال‌ها و گیرندگان
 *   templates                  : قالب پیام‌ها با پیش‌نمایش
 *   print                      : سربرگ چاپ (لوگو، نام شرکت) و طراحی قالب‌های چاپ
 *   sms                        : پنل پیامک، ساعات سکوت، یادآوری‌ها، پیامک آزمایشی
 *   roles                      : ماتریس نقش × توانایی
 *   logs                       : گزارش ارسال
 *   advanced                   : جدول همه تنظیمات (نمای قدیمی)
 */
export const settingsRoutes: Routes = [
  {
    path: '',
    component: SettingsShellComponent,
    children: [
      {
        path: '', pathMatch: 'full',
        // اولین بخشی که کاربر به آن دسترسی دارد (مثلاً کاربری که فقط «قالب‌های چاپ» دارد)
        redirectTo: () => {
          const session = inject(SessionStore);
          return SETTINGS_NAV.find(i => session.hasAnyPermission(i.perms))?.path ?? 'general';
        },
      },
      {
        path: 'general', title: 'تنظیمات عمومی', canActivate: [permissionGuard('MT_Settings')],
        loadComponent: () => import('./general/settings-form.component').then(m => m.SettingsFormComponent),
        data: { categories: [1, 5], title: 'تنظیمات عمومی و فایل', icon: 'fa-sliders' },
      },
      {
        path: 'meetings', title: 'تنظیمات جلسات', canActivate: [permissionGuard('MT_Settings')],
        loadComponent: () => import('./general/settings-form.component').then(m => m.SettingsFormComponent),
        data: { categories: [2, 7], title: 'جلسات، مصوبات و ارجاع', icon: 'fa-people-group' },
      },
      {
        path: 'board', title: 'هیئت مدیره', canActivate: [permissionGuard('MT_Settings')],
        loadComponent: () => import('./general/settings-form.component').then(m => m.SettingsFormComponent),
        data: { categories: [3], title: 'هیئت مدیره و کمیسیون معاملات', icon: 'fa-landmark' },
      },
      {
        path: 'print', title: 'چاپ و قالب‌ها', canActivate: [permissionGuard('MT_PrintTemplates', 'MT_Settings')],
        loadComponent: () => import('./print/print-settings.component').then(m => m.PrintSettingsComponent),
      },
      {
        path: 'notifications', title: 'رویدادهای اطلاع‌رسانی', canActivate: [permissionGuard('MT_Settings')],
        loadComponent: () => import('./notification-events/notification-events.component').then(m => m.NotificationEventsComponent),
      },
      {
        path: 'templates', title: 'قالب پیام‌ها', canActivate: [permissionGuard('MT_Settings')],
        loadComponent: () => import('./notification-templates/notification-templates.component').then(m => m.NotificationTemplatesComponent),
      },
      {
        path: 'sms', title: 'پیامک و زمان‌بندی', canActivate: [permissionGuard('MT_Settings')],
        loadComponent: () => import('./sms/sms-settings.component').then(m => m.SmsSettingsComponent),
      },
      {
        path: 'roles', title: 'نقش‌ها و دسترسی‌ها', canActivate: [permissionGuard('MT_UserRoles', 'MT_Settings')],
        loadComponent: () => import('./roles/role-capabilities.component').then(m => m.RoleCapabilitiesComponent),
      },
      {
        path: 'logs', title: 'گزارش ارسال', canActivate: [permissionGuard('MT_Settings')],
        loadComponent: () => import('./logs/notification-logs.component').then(m => m.NotificationLogsComponent),
      },
      {
        path: 'advanced', title: 'همه تنظیمات', canActivate: [permissionGuard('MT_Settings')],
        loadComponent: () => import('../system-setting/system-setting.component').then(m => m.SystemSettingListComponent),
      },
    ],
  },
];
