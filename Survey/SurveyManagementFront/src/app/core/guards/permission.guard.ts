import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { ToastService } from '../../services/framework-services/toast.service';

/** مدیر سامانه (SV_Admin) به همه‌ی بخش‌ها دسترسی دارد. */
export const SURVEY_ADMIN = 'SV_Admin';

/**
 * گارد دسترسی بر اساس دسترسی‌های سمت فعال (حداقل یکی از موارد کافی است).
 * فقط برای تجربه‌ی کاربری است؛ تصمیم نهایی دسترسی همیشه سمت سرور گرفته می‌شود.
 */
export function permissionGuard(...permissions: string[]): CanActivateFn {
  return async () => {
    const auth = inject(PasswordFlowService);
    if (await auth.checkPermission([SURVEY_ADMIN, ...permissions])) return true;
    inject(ToastService).error('شما مجوز دسترسی به این بخش را ندارید.', 'عدم دسترسی');
    return inject(Router).createUrlTree(['/dashboard']);
  };
}
