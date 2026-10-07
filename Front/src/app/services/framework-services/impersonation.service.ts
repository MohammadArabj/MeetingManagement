import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';

import { IdentityService, ImpersonationTarget as IdentityImpersonationTarget } from '../../core/auth/identity.service';

export interface ImpersonationTarget extends IdentityImpersonationTarget {
  persNo?: string;
}

/**
 * «ورود به جای کاربر» — رابط سازگار با کدهای قبلی؛ منطق اصلی در {@link IdentityService} است
 * (دریافت دسترسی‌ها، ذخیره‌ی یکجا، پاک کردن داده‌های کش‌شده و بارگذاری کامل برنامه).
 */
@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private readonly identity = inject(IdentityService);

  readonly isImpersonating = this.identity.isImpersonating;
  readonly impersonatedUserName = this.identity.impersonatedUserName;
  readonly impersonatedPositionName = this.identity.impersonatedPositionName;

  /** پس از موفقیت، برنامه خودکار روی داشبورد کاربر جدید بارگذاری می‌شود */
  impersonate(target: ImpersonationTarget): Observable<boolean> {
    return from(this.identity.impersonate(target));
  }

  exitImpersonation(reload = true): Observable<boolean> {
    const was = this.identity.isImpersonating();
    this.identity.exitImpersonation(reload);
    return from(Promise.resolve(was));
  }

  checkIsImpersonating(): boolean {
    return this.identity.isImpersonating();
  }
}
