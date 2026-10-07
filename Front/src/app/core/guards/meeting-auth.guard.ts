import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/** سازگاری با مسیرهای قدیمی: همان authGuard */
export const meetingAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;
  auth.login(state.url);
  return false;
};
