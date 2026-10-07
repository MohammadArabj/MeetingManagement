import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * کاربر باید لاگین باشد؛ در غیر این صورت با حفظ مسیر مقصد به SSO هدایت می‌شود.
 * (نسخه قبلی برای هر بار چک، localStorage را با ۱۴ کلید پاک/بازنویسی می‌کرد.)
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  auth.login(state.url);
  return false;
};
