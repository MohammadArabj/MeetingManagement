import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService, currentRoute } from '../auth/auth.service';
import { getClientSettings } from '../auth/auth.config';
import { SessionStore } from '../auth/session.store';
import { ToastService } from '../../services/framework-services/toast.service';

/**
 * افزودن توکن و هویت عامل به درخواست‌ها.
 * ─────────────────────────────────────────────────────────────────────────
 * ✅ توکن فقط به API های خودمان ارسال می‌شود (قبلاً به هر آدرسی ارسال می‌شد).
 * ✅ X-Position-Guid / X-Acting-User: سمت فعال و کاربر عامل (تفویض) — سرور آن را راستی‌آزمایی می‌کند.
 * ✅ 401 → ورود مجدد با حفظ مسیر | 403 → فقط پیام (قبلاً کاربر را logout می‌کرد!)
 * ✅ باگ قبلی: if (flow = 'code') به‌جای === (انتساب به‌جای مقایسه).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('skip')) {
    return next(req.clone({ headers: req.headers.delete('skip') }));
  }

  const auth = inject(AuthService);
  if (!auth.isApiUrl(req.url)) return next(req);

  const session = inject(SessionStore);
  const toast = inject(ToastService);
  const token = auth.accessToken();

  const headers: Record<string, string> = { 'Client-Id': getClientSettings().client_id };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (session.positionGuid()) headers['X-Position-Guid'] = session.positionGuid();
  if (session.userGuid()) headers['X-Acting-User'] = session.userGuid();

  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          auth.login(currentRoute());
        } else if (error.status === 403) {
          toast.error(extractMessage(error) ?? 'شما مجوز انجام این عملیات را ندارید.', 'عدم دسترسی');
        }
      }
      return throwError(() => error);
    }),
  );
};

function extractMessage(error: HttpErrorResponse): string | null {
  const body = error.error;
  if (body && typeof body === 'object' && typeof body.message === 'string') return body.message;
  return null;
}
