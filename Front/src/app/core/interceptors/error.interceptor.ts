import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../../services/framework-services/toast.service';

/**
 * نمایش خطاهای HTTP به کاربر.
 * ✅ پیام‌های اعتبارسنجی ASP.NET (ModelState) نمایش داده می‌شوند، نه یک پیام کلی.
 * ✅ خطای اصلی (HttpErrorResponse) دوباره پرتاب می‌شود تا وضعیت (status) به فراخوان برسد.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.error instanceof ErrorEvent) {
        return throwError(() => error);
      }

      switch (error.status) {
        case 0:
          toast.error('ارتباط با سرور برقرار نشد. اتصال شبکه را بررسی کنید.', 'خطای ارتباط');
          break;
        case 400:
          if (error.error?.error === 'invalid_client' || error.error?.error === 'invalid_grant') {
            toast.error(error.error.error_description ?? 'خطای ورود', 'خطای ورود');
          } else {
            toast.error(validationMessage(error) ?? 'اطلاعات فرم به درستی وارد نشده است.', 'خطای فرم');
          }
          break;
        case 404:
          toast.error('آدرس درخواستی یافت نشد.', 'خطا');
          break;
        case 410:
          toast.error(typeof error.error === 'string' ? error.error : 'درخواست قابل انجام نیست.');
          break;
        case 401:
        case 403:
          break; // توسط authInterceptor مدیریت می‌شود
        default:
          if (error.status >= 500) {
            toast.error(typeof error.error === 'string' && error.error.length < 300
              ? error.error
              : 'خطایی در سرور رخ داده است. لطفاً با مدیر سیستم تماس بگیرید.', 'خطای سرور');
          }
      }
      return throwError(() => error);
    }),
  );
};

/** استخراج پیام‌های ModelState: { errors: { Field: ["msg"] } } */
function validationMessage(error: HttpErrorResponse): string | null {
  const errors = error.error?.errors;
  if (!errors || typeof errors !== 'object') return typeof error.error?.message === 'string' ? error.error.message : null;
  const messages = Object.values(errors).flat().filter((m): m is string => typeof m === 'string');
  return messages.length ? Array.from(new Set(messages)).slice(0, 3).join(' | ') : null;
}
