import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';

import { routes } from './app.routes';
import { ValidationInterceptor } from './core/interceptors/validation.interceptor.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // ترتیب: اعتبارسنجی فرم (پیش از ارسال) ← نوار بارگذاری ← نمایش خطا ← توکن/هویت عامل
    provideHttpClient(withInterceptorsFromDi(), withInterceptors([loadingInterceptor, errorInterceptor, authInterceptor])),
    { provide: HTTP_INTERCEPTORS, useClass: ValidationInterceptor, multi: true },
  ]
};
