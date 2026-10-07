import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { LocationStrategy, HashLocationStrategy } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { SystemSettingService } from './services/system-setting.service';
import { AuthService } from './core/auth/auth.service';
import { SessionBootstrapService } from './core/auth/session-bootstrap.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { validationInterceptor } from './core/interceptors/validation.interceptor';
import { MeetingAccessService } from './core/meeting-access/meeting-access.service';

/**
 * ترتیب interceptor ها (درخواست از بالا به پایین، پاسخ برعکس):
 *   validation → loading → auth → error
 * - validation: قبل از هر چیز؛ اگر فرم نامعتبر است درخواست اصلاً ارسال نمی‌شود
 * - loading:    شمارش درخواست‌ها با finalize
 * - auth:       توکن + هویت عامل؛ 401/403
 * - error:      نمایش پیام خطا
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([validationInterceptor, loadingInterceptor, authInterceptor, errorInterceptor])),
    provideRouter(routes),
    { provide: LocationStrategy, useClass: HashLocationStrategy },

    // ① پردازش بازگشت از SSO / بارگذاری کاربر  ② آماده‌سازی نشست و دسترسی‌ها  ③ تنظیمات عمومی
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const bootstrap = inject(SessionBootstrapService);
      const settings = inject(SystemSettingService);
      const meetingAccess = inject(MeetingAccessService);

      const { freshLogin } = await auth.init();
      await Promise.all([
        bootstrap.run(freshLogin),
        settings.initializePublicSettings(),
        auth.isAuthenticated() ? meetingAccess.loadRoleConfig() : Promise.resolve(),
      ]);
    }),
  ]
};
