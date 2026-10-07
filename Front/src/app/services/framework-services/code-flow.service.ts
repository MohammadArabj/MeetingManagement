import { inject, Injectable } from '@angular/core';
import { User } from 'oidc-client-ts';
import { AuthService } from '../../core/auth/auth.service';
import { BreadcrumbService } from './breadcrumb.service';

export { getClientSettings } from '../../core/auth/auth.config';

/**
 * لایه سازگاری برای کدهای قبلی (حدود ۴۰ فایل از این سرویس استفاده می‌کنند).
 * پیاده‌سازی واقعی در AuthService (oidc-client-ts) است؛ کد جدید مستقیماً AuthService را inject کند.
 * @deprecated از AuthService استفاده کنید.
 */
@Injectable({
  providedIn: 'root'
})
export class CodeFlowService {
  private readonly auth = inject(AuthService);
  private readonly breadcrumbService = inject(BreadcrumbService);

  /** کاربر جاری (profile شامل claim ها) */
  get user(): User | null {
    return this.auth.user();
  }

  async isLoggedIn(): Promise<boolean> {
    return this.auth.isAuthenticated();
  }

  getClaims(): any {
    return this.auth.profile();
  }

  getAuthorizationHeaderValue(): string {
    const token = this.auth.accessToken();
    return token ? `Bearer ${token}` : '';
  }

  startAuthentication(returnUrl?: string): Promise<void> {
    return this.auth.login(returnUrl);
  }

  /** callback اکنون در APP_INITIALIZER پردازش می‌شود؛ این متد فقط برای سازگاری باقی مانده است. */
  async completeAuthentication(): Promise<void> {
    return;
  }

  async logout(): Promise<void> {
    this.breadcrumbService.reset();
    await this.auth.logout();
  }

  getToken(): string {
    return this.auth.accessToken() ?? '';
  }
}
