import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SessionStore } from '../../core/auth/session.store';
import { BreadcrumbService } from './breadcrumb.service';

/**
 * لایه سازگاری: ۱۶ کامپوننت از checkPermission این سرویس استفاده می‌کنند.
 * ✅ حذف Password Flow (client_secret کلاینت PhoenixClient داخل باندل بود و استفاده‌ای نداشت).
 * ✅ checkPermission دیگر هر بار رشته CSV را با PapaParse پارس نمی‌کند؛ از SessionStore می‌خواند.
 * @deprecated برای دسترسی‌ها از SessionStore و برای خروج از AuthService استفاده کنید.
 */
@Injectable({
  providedIn: 'root'
})
export class PasswordFlowService {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly breadcrumbService = inject(BreadcrumbService);

  logout(): void {
    this.breadcrumbService.reset();
    void this.auth.logout();
  }

  isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }

  getToken(): string {
    return this.auth.accessToken() ?? '';
  }

  async checkPermission(neededPermission: string | string[]): Promise<boolean> {
    return this.hasPermission(neededPermission);
  }

  hasPermission(neededPermission: string | string[]): boolean {
    if (!this.session.hasPermissionsLoaded() && !this.session.isSuperAdmin()) return false;
    return this.session.hasAnyPermission(neededPermission);
  }

  hasNoAnyPermissions(): boolean {
    return !this.session.hasPermissionsLoaded();
  }

  getPermissions(): string {
    return Array.from(this.session.permissions()).join(',');
  }
}
