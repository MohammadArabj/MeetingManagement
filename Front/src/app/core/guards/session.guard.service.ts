import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SessionBootstrapService } from '../auth/session-bootstrap.service';

/**
 * نشست SSO باید فعال باشد (مثلاً اگر مدیر نشست را بسته باشد).
 * ✅ قبلاً در «هر» جابجایی صفحه یک درخواست به سرور ارسال می‌شد (runGuardsAndResolvers: 'always')؛
 * حالا نتیجه برای sessionCheckIntervalMs کش می‌شود و خطای شبکه کاربر را بیرون نمی‌اندازد.
 */
export const sessionGuard: CanActivateFn = async (_route, state) => {
  const bootstrap = inject(SessionBootstrapService);
  const auth = inject(AuthService);

  if (await bootstrap.isSessionActive(environment.auth.sessionCheckIntervalMs)) return true;
  // نشست ذخیره‌شده (از ورود قبلی) بسته شده است: با نشست فعلی SSO بی‌صدا دوباره وارد می‌شویم
  // (نه خروج کامل که نشست تازه‌ی SSO کاربر را هم می‌بست و رمز را دوباره می‌خواست)
  await auth.relogin(state.url);
  return false;
};
