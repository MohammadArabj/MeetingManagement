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
export const sessionGuard: CanActivateFn = async () => {
  const bootstrap = inject(SessionBootstrapService);
  const auth = inject(AuthService);

  if (await bootstrap.isSessionActive(environment.auth.sessionCheckIntervalMs)) return true;
  await auth.logout();
  return false;
};
