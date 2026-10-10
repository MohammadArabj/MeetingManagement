import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SKIP_AUTH } from '../../services/framework-services/http.service';
import { environment } from '../../../environments/environment';

/**
 * صفحه‌ی شرکت در نظرسنجی (تنها مسیری که بدون ورود هم باز می‌شود).
 *  ۱) کاربر واردشده → ادامه (مانند authGuard).
 *  ۲) بدون ورود: اگر سرور نظرسنجی را برای کاربر ناشناس قابل پاسخ بداند → ادامه به‌صورت ناشناس.
 *  ۳) در غیر این صورت ورود SSO با حفظ آدرس همین نظرسنجی (AuthService.login، مانند authGuard).
 */
export const surveyTakeGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;

  const guid = route.paramMap.get('surveyGuid') ?? '';
  try {
    const result: any = await firstValueFrom(inject(HttpClient)
      .get(`${environment.getServiceUrl()}Survey/Public/${encodeURIComponent(guid)}`, { context: new HttpContext().set(SKIP_AUTH, true) })
      .pipe(timeout(15000)));
    if (result?.isSuccess && result.data) return true;
  } catch { /* ادامه: ورود */ }

  await auth.login(state.url);
  return false;
};
