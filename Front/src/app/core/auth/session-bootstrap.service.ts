import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DelegationService } from '../../services/delegation.service';
import { PermissionService } from '../../services/permission.service';
import { UserService } from '../../services/user.service';
import { AuthService } from './auth.service';
import { getClientSettings } from './auth.config';
import { normalizePermissions, SessionStore } from './session.store';

/**
 * آماده‌سازی جلسه کاری پس از ورود (جایگزین منطق ChallengeComponent):
 *   ۱) مقداردهی سمت/کاربر از Claim ها
 *   ۲) دریافت شناسه نشست SSO
 *   ۳) بررسی دسترسی به این سامانه (یک بار)
 *   ۴) دریافت دسترسی‌ها (از Claim «permission» توکن؛ در تفویض از API)
 * نتایج کش می‌شوند تا گاردها در هر جابجایی صفحه API صدا نزنند.
 */
@Injectable({ providedIn: 'root' })
export class SessionBootstrapService {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly userService = inject(UserService);
  private readonly permissionService = inject(PermissionService);
  private readonly delegationService = inject(DelegationService);

  private clientAccess: boolean | null = null;
  private lastSessionCheck = 0;
  private sessionCheckPromise: Promise<boolean> | null = null;

  async run(freshLogin: boolean): Promise<void> {
    if (!this.auth.isAuthenticated()) return;

    const profile = this.auth.profile() as Record<string, any>;
    const token = this.auth.accessToken() ?? '';

    if (freshLogin || !this.session.userGuid()) {
      this.session.initFromClaims(profile, token);
    }

    if (freshLogin || !this.session.sessionGuid()) {
      try {
        const current = await firstValueFrom(this.userService.getCurrentSession());
        if (!current?.sessionGuid) {
          await this.auth.logout();
          return;
        }
        this.session.setSessionGuid(current.sessionGuid);
        this.lastSessionCheck = Date.now();
      } catch (e) {
        console.error('[Session] getCurrentSession failed', e);
      }
    }

    if (freshLogin || !this.session.hasPermissionsLoaded()) {
      await this.loadPermissions(profile, token);
    }
  }

  /** دسترسی به این سامانه (یک بار در هر بارگذاری برنامه) */
  async hasClientAccess(): Promise<boolean> {
    if (this.clientAccess !== null) return this.clientAccess;
    try {
      const result = await firstValueFrom(this.userService.hasClientAccess(getClientSettings().client_id));
      this.clientAccess = !!result?.hasAccess;
    } catch {
      this.clientAccess = false;
    }
    return this.clientAccess;
  }

  /** فعال بودن نشست SSO؛ حداکثر هر sessionCheckIntervalMs یک بار از سرور پرسیده می‌شود */
  async isSessionActive(intervalMs: number): Promise<boolean> {
    if (Date.now() - this.lastSessionCheck < intervalMs) return true;
    this.sessionCheckPromise ??= (async () => {
      try {
        const res = await firstValueFrom(this.userService.hasActiveSession({ sessionGuid: this.session.sessionGuid() }));
        if (res?.isActive) this.lastSessionCheck = Date.now();
        return !!res?.isActive;
      } catch {
        // خطای شبکه نباید کاربر را بیرون بیندازد
        return true;
      } finally {
        this.sessionCheckPromise = null;
      }
    })();
    return this.sessionCheckPromise;
  }

  private async loadPermissions(profile: Record<string, any>, token: string): Promise<void> {
    const isDelegate = String(profile['isDelegate'] ?? '') === 'true';

    if (!isDelegate) {
      const fromToken = permissionsFromToken(token);
      if (fromToken.length > 0) {
        this.session.setPermissions(fromToken);
        return;
      }
    }

    try {
      const permissions = isDelegate
        ? await firstValueFrom(this.delegationService.getDelegationPermissions({
            delegationId: profile['delegationId'],
            clientId: getClientSettings().client_id,
          }))
        : await firstValueFrom(this.permissionService.getPositionPermissions(this.session.positionGuid()));
      this.session.setPermissions(permissions);
    } catch (e) {
      console.error('[Session] loading permissions failed', e);
    }
  }
}

/** خواندن claim های permission از payload توکن (بدون اعتبارسنجی امضا؛ صرفاً برای نمایش UI) */
export function permissionsFromToken(token: string): string[] {
  try {
    const payload = token.split('.')[1];
    if (!payload) return [];
    const json = decodeURIComponent(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      .split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const claims = JSON.parse(json);
    return normalizePermissions(claims['permission']);
  } catch {
    return [];
  }
}
