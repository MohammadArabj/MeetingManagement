import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { HttpService } from '../../services/framework-services/http.service';
import { safeReturnUrl } from '../../services/framework-services/auth-utils';
import { environment } from '../../../environments/environment';

export const ANONYMOUS_MODE_KEY = 'survey_anonymous_mode';

/**
 * صفحه‌ی شرکت در نظرسنجی.
 * ✅ قبلاً فقط وجود توکن در storage بررسی می‌شد (حتی منقضی) و کاربر بدون توکن به داشبورد پرت می‌شد.
 * حالا:
 *  ۱) نشست معتبر → ادامه.
 *  ۲) بدون نشست: اگر سرور نظرسنجی را برای کاربر ناشناس قابل پاسخ بداند → ادامه به‌صورت ناشناس.
 *  ۳) در غیر این صورت ورود SSO با حفظ آدرس همین نظرسنجی تا کاربر بعد از ورود دقیقاً
 *     به همان‌جا (و همان سؤالی که نیمه‌کاره گذاشته بود) برگردد.
 */
export const surveyAuthGuard: CanActivateFn = async (route, state) => {
  const auth = inject(CodeFlowService);
  const http = inject(HttpService);
  sessionStorage.removeItem(ANONYMOUS_MODE_KEY);
  try {
    if (await auth.isLoggedIn()) return true;
  } catch { /* ادامه */ }

  const guid = route.paramMap.get('surveyGuid') ?? '';
  try {
    const result: any = await firstValueFrom(
      http.getFullUrlNoAuth(`${environment.getServiceUrl()}Survey/Public/${encodeURIComponent(guid)}`).pipe(timeout(15000)));
    if (result?.isSuccess && result.data) {
      sessionStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
      return true;
    }
  } catch { /* ادامه: ورود */ }

  sessionStorage.setItem('survey_return_url', safeReturnUrl(state.url));
  await auth.startAuthentication();
  return false;
};
