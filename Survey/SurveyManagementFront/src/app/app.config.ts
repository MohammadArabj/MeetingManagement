import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LocationStrategy, HashLocationStrategy } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { SessionBootstrapService } from './core/auth/session-bootstrap.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { validationInterceptor } from './core/interceptors/validation.interceptor';
import { migratePathRouteToHash } from './core/auth/legacy-route';

/**
 * پیکربندی دقیقاً مطابق سامانه مدیریت جلسات.
 * ترتیب interceptor ها (درخواست از بالا به پایین، پاسخ برعکس):
 *   validation → loading → auth → error
 * - validation: قبل از هر چیز؛ اگر فرم نامعتبر است درخواست اصلاً ارسال نمی‌شود
 * - loading:    شمارش درخواست‌ها با finalize
 * - auth:       توکن + هویت عامل؛ 401/403
 * - error:      نمایش پیام خطا
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([validationInterceptor, loadingInterceptor, authInterceptor, errorInterceptor])),
    provideRouter(routes),
    { provide: LocationStrategy, useClass: HashLocationStrategy },

    // ① پردازش بازگشت از SSO / بارگذاری کاربر  ② آماده‌سازی نشست، سمت و دسترسی‌ها
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const bootstrap = inject(SessionBootstrapService);

      const { freshLogin } = await auth.init();
      // لینک‌های قدیمی بدون # (مثل /survey/take/{guid} یا QR کدهای چاپ‌شده) به مسیر hash تبدیل می‌شوند
      migratePathRouteToHash();
      await bootstrap.run(freshLogin);
    }),
  ]
};
