import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SessionBootstrapService } from '../auth/session-bootstrap.service';

/** کاربر باید به این سامانه دسترسی داشته باشد (یک بار در هر بارگذاری بررسی می‌شود). */
export const clientAccessGuard: CanActivateFn = async () => {
  const bootstrap = inject(SessionBootstrapService);
  if (await bootstrap.hasClientAccess()) return true;
  await inject(AuthService).logout();
  return false;
};
