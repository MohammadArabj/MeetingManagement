import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { CodeFlowService, getClientSettings } from '../../services/framework-services/code-flow.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { EFFECTIVE_USER_ID, LocalStorageService } from '../../services/framework-services/local.storage.service';
import { SKIP_AUTH } from '../../services/framework-services/http.service';
import { ToastService } from '../../services/framework-services/toast.service';
import { safeReturnUrl } from '../../services/framework-services/auth-utils';
import { environment } from '../../../environments/environment';
import { IMPERSONATED_USER_GUID, IS_IMPERSONATING, Main_USER_ID, POSITION_ID } from '../types/configuration';
import { isTrustedApi } from './auth-api-roots';

/**
 * افزودن توکن و هویت عامل به درخواست‌ها.
 * ─────────────────────────────────────────────────────────────────────────
 * ✅ توکن فقط به API های خودمان ارسال می‌شود.
 * ✅ X-Position-Guid / X-Acting-User: سمت فعال و کاربر عامل (تفویض/ورود به‌جای کاربر).
 *    این‌ها فقط «درخواست» هستند؛ سرور (ActingIdentityResolver) آن‌ها را با UserManagement راستی‌آزمایی می‌کند.
 * ✅ 401 → ورود مجدد با حفظ مسیر فعلی | 403 → فقط پیام.
 */
const RELOGIN_KEY = 'survey.relogin-at';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const skip = req.context.get(SKIP_AUTH) || req.headers.has('skip');
  if (req.headers.has('skip')) req = req.clone({ headers: req.headers.delete('skip') });
  if (skip || !isTrustedApi(req.url)) return next(req);

  const code = inject(CodeFlowService);
  const password = inject(PasswordFlowService);
  const storage = inject(LocalStorageService);
  const toast = inject(ToastService);

  const token = environment.ssoAuthenticationFlow === 'code' ? code.getToken() : password.getToken();
  if (!token) return next(req);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Client-Id': getClientSettings().client_id,
  };
  const position = storage.getItem(POSITION_ID);
  if (position) headers['X-Position-Guid'] = position;
  const acting = storage.getItem(IS_IMPERSONATING) === 'true'
    ? storage.getItem(IMPERSONATED_USER_GUID)
    : storage.getItem(EFFECTIVE_USER_ID) || storage.getItem(Main_USER_ID);
  if (acting) headers['X-Acting-User'] = acting;

  return next(req.clone({ setHeaders: headers })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          // جلوگیری از حلقه‌ی بی‌پایان ورود وقتی سرور توکن معتبر را (مثلاً به‌خاطر تنظیمات) نمی‌پذیرد
          const last = Number(sessionStorage.getItem(RELOGIN_KEY) ?? 0);
          if (Date.now() - last > 60_000) {
            sessionStorage.setItem(RELOGIN_KEY, String(Date.now()));
            sessionStorage.setItem('survey_return_url', safeReturnUrl(location.pathname + location.search));
            void code.startAuthentication();
          } else {
            toast.error('نشست شما معتبر نیست. لطفاً صفحه را دوباره بارگذاری کنید.', 'خطای ورود');
          }
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
  if (typeof body === 'string' && body && body.length < 300) return body;
  if (body && typeof body === 'object' && typeof body.message === 'string') return body.message;
  return null;
}
