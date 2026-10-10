import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../auth/session.store';
import { ToastService } from '../../services/framework-services/toast.service';

/**
 * محدودسازی مسیر به دارندگان حداقل یکی از دسترسی‌ها.
 * ✅ قبلاً صفحات تنظیمات فقط در منو مخفی بودند و با تایپ آدرس قابل دسترس بودند.
 *
 * استفاده:  canActivate: [permissionGuard('MT_Settings')]
 */
export function permissionGuard(...permissions: string[]): CanActivateFn {
  return () => {
    const session = inject(SessionStore);
    if (session.hasAnyPermission(permissions)) return true;

    inject(ToastService).error('شما به این بخش دسترسی ندارید.');
    return inject(Router).createUrlTree(['/dashboard']);
  };
}
