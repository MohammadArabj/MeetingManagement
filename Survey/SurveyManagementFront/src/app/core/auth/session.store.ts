import { computed, Injectable, signal, inject } from '@angular/core';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import {
  ACCESS_TOKEN_NAME, IsDeletage, ISSP, Main_USER_ID, PERMISSIONS_NAME, POSITION_ID, POSITION_NAME,
  ROLE_TOKEN_NAME, USER_CURRENT_ACTIVE_SESSION_NAME, USER_ID_NAME,
} from '../types/configuration';

/** «مدیر سامانه نظرسنجی»: دسترسی کامل به همه‌ی بخش‌ها در همه‌ی وضعیت‌ها (هم‌نام SurveyPermissions.Admin در سرور) */
export const SURVEY_ADMIN_PERMISSION = 'SV_Admin';
/** «ورود به جای کاربر» (هم‌نام Permissions.Impersonate در سرور) */
export const IMPERSONATE_PERMISSION = 'SV_Impersonate';

/** کلیدهایی از localStorage که وضعیت جلسه کاری کاربر را نگه می‌دارند */
const TRACKED_KEYS = new Set([USER_ID_NAME, Main_USER_ID, POSITION_ID, POSITION_NAME, IsDeletage, ISSP, PERMISSIONS_NAME, USER_CURRENT_ACTIVE_SESSION_NAME]);

/**
 * وضعیت جلسه کاری کاربر (سمت فعال، تفویض، دسترسی‌ها) به‌صورت Signal.
 * ─────────────────────────────────────────────────────────────────────────
 * کدهای قدیمی (هدر، تفویض، جانشینی و ...) هنوز مستقیماً روی localStorage می‌نویسند؛
 * این Store با گوش دادن به LocalStorageService.changes همیشه با آن هم‌گام است، پس
 * کامپوننت‌های جدید می‌توانند واکنشی (reactive) کار کنند بدون شکستن کدهای قدیمی.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly storage = inject(LocalStorageService);

  private readonly _tokenUserGuid = signal('');
  private readonly _userGuid = signal('');
  private readonly _positionGuid = signal('');
  private readonly _positionName = signal('');
  private readonly _isDelegate = signal(false);
  private readonly _isSuperAdmin = signal(false);
  private readonly _sessionGuid = signal('');
  private readonly _permissions = signal<ReadonlySet<string>>(new Set());

  readonly tokenUserGuid = this._tokenUserGuid.asReadonly();
  /** کاربری که به نام او عمل می‌شود (در تفویض = تفویض‌دهنده) */
  readonly userGuid = this._userGuid.asReadonly();
  readonly positionGuid = this._positionGuid.asReadonly();
  readonly positionName = this._positionName.asReadonly();
  readonly isDelegate = this._isDelegate.asReadonly();
  readonly isSuperAdmin = this._isSuperAdmin.asReadonly();
  readonly sessionGuid = this._sessionGuid.asReadonly();
  readonly permissions = this._permissions.asReadonly();
  readonly hasPermissionsLoaded = computed(() => this._permissions().size > 0);

  constructor() {
    this.reloadFromStorage();
    this.storage.changes.subscribe(key => {
      if (key === null || TRACKED_KEYS.has(key)) this.reloadFromStorage();
    });
    // هم‌گامی بین تب‌ها
    window.addEventListener('storage', e => {
      if (e.key === null || TRACKED_KEYS.has(e.key)) this.reloadFromStorage();
    });
  }

  hasPermission(permission: string): boolean {
    return this._isSuperAdmin() || this._permissions().has(permission);
  }

  hasAnyPermission(permissions: string | readonly string[] | null | undefined): boolean {
    if (!permissions || (Array.isArray(permissions) && permissions.length === 0)) return true;
    const list = Array.isArray(permissions) ? permissions : [permissions as string];
    return list.some(p => this.hasPermission(p));
  }

  /** مقداردهی پس از ورود از روی Claim های توکن */
  initFromClaims(profile: Record<string, any>, accessToken: string): void {
    const id = String(profile['id'] ?? profile['sub'] ?? '');
    this.storage.setItem(Main_USER_ID, id);
    this.storage.setItem(USER_ID_NAME, id);
    this.storage.setItem(POSITION_ID, String(profile['activatedPosition'] ?? ''));
    this.storage.setItem(POSITION_NAME, String(profile['positionTitle'] ?? ''));
    this.storage.setItem(ROLE_TOKEN_NAME, String(profile['position'] ?? ''));
    this.storage.setItem(IsDeletage, String(profile['isDelegate'] ?? 'false'));
    this.setAccessToken(accessToken);
  }

  /** توکن برای کدهای قدیمی (مثل آپلود tus) که مستقیماً از localStorage می‌خوانند */
  setAccessToken(token: string): void {
    this.storage.setItem(ACCESS_TOKEN_NAME, token);
  }

  setPermissions(permissions: string | readonly string[] | null | undefined): void {
    const list = normalizePermissions(permissions);
    this.storage.setItem(PERMISSIONS_NAME, list.join(','));
  }

  setSessionGuid(sessionGuid: string): void {
    this.storage.setItem(USER_CURRENT_ACTIVE_SESSION_NAME, sessionGuid ?? '');
  }

  clear(): void {
    [ACCESS_TOKEN_NAME, ROLE_TOKEN_NAME, USER_ID_NAME, Main_USER_ID, POSITION_ID, POSITION_NAME, IsDeletage,
      PERMISSIONS_NAME, ISSP, USER_CURRENT_ACTIVE_SESSION_NAME, 'Settings', 'dbName', 'comapny_id', 'org_id']
      .forEach(k => this.storage.removeItem(k));
    this.reloadFromStorage();
  }

  private reloadFromStorage(): void {
    this._tokenUserGuid.set(this.storage.getItem(Main_USER_ID));
    this._userGuid.set(this.storage.getItem(USER_ID_NAME));
    this._positionGuid.set(this.storage.getItem(POSITION_ID));
    this._positionName.set(this.storage.getItem(POSITION_NAME));
    this._isDelegate.set(this.storage.getItem(IsDeletage) === 'true');
    this._sessionGuid.set(this.storage.getItem(USER_CURRENT_ACTIVE_SESSION_NAME));
    const permissions = new Set(normalizePermissions(this.storage.getItem(PERMISSIONS_NAME)));
    this._permissions.set(permissions);
    // ادمین = مدیر کل (UserManagement) یا سمت دارای «مدیر سامانه نظرسنجی»؛ هیچ‌کدام از راه تفویض نمی‌آید (مانند سرور)
    const isDelegate = this.storage.getItem(IsDeletage) === 'true';
    this._isSuperAdmin.set(!isDelegate && (this.storage.getItem(ISSP) === 'true' || permissions.has(SURVEY_ADMIN_PERMISSION)));
  }
}

/** دسترسی‌ها ممکن است آرایه، رشته‌ی CSV یا JSON باشند (API های مختلف) */
export function normalizePermissions(value: string | readonly string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  const text = String(value).trim();
  if (text.startsWith('[')) {
    try { return normalizePermissions(JSON.parse(text)); } catch { /* ادامه با CSV */ }
  }
  return text.split(/[,\r\n]+/).map(v => v.replace(/^"|"$/g, '').trim()).filter(Boolean);
}

/**
 * ادمین بودن کاربر جاری (برای کدهایی که SessionStore را تزریق نکرده‌اند)؛ همان منطق SessionStore.isSuperAdmin.
 */
export function readIsSurveyAdmin(): boolean {
  if (localStorage.getItem(IsDeletage) === 'true') return false;
  if (localStorage.getItem(ISSP) === 'true') return true;
  return normalizePermissions(localStorage.getItem(PERMISSIONS_NAME)).includes(SURVEY_ADMIN_PERMISSION);
}
