import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { DelegationService } from '../../services/framework-services/delegation.service';
import { PermissionService } from '../../services/permission.service';
import { UserService } from '../../services/user.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { ToastService } from '../../services/framework-services/toast.service';
import { getClientSettings } from './auth.config';
import { normalizePermissions, SessionStore } from './session.store';
import {
  ADMIN_IS_DELEGATE, ADMIN_MAIN_USER_ID, ADMIN_PERMISSIONS, ADMIN_POSITION_ID, ADMIN_POSITION_NAME, ADMIN_USER_ID,
  IMPERSONATED_POSITION_NAME, IMPERSONATED_USER_GUID, IMPERSONATED_USER_NAME, IS_IMPERSONATING, IsDeletage, ISSP,
  Main_USER_ID, PERMISSIONS_NAME, POSITION_ID, POSITION_NAME, USER_CLASSIFICATION_LEVEL_ID_NAME, USER_COMPANY_ID_NAME,
  USER_ID_NAME, USER_ORGANIZATION_CHART_ID_NAME,
} from '../types/configuration';

/** اطلاعات کاربری که «به نام او» کار می‌شود (سربرگ، داشبورد، ...) */
export interface ActingProfile {
  userGuid: string;
  fullname: string;
  /** شماره پرسنلی / نام کاربری */
  userName: string;
  companyTitle: string;
  organizationChartTitle: string;
  classificationLevel: string;
  companyGuid: string;
  organizationChartGuid: string;
  classificationLevelGuid?: string;
  needChangePassword: boolean;
}

/** یک سمت قابل انتخاب: سمت‌های خود کاربر یا تفویض‌های فعال به او */
export interface IdentityOption {
  id: number | string;
  userGuid: string;
  userName: string;
  positionGuid: string;
  position: string;
  isDelegate: boolean;
  isSuperAdmin: boolean;
}

export interface ImpersonationTarget {
  userGuid: string;
  positionGuid: string;
  userName: string;
  positionName: string;
}

const PROFILE_CACHE_KEY = 'sv.acting.profile';

/**
 * تنها نقطه‌ی تغییر «هویت عامل»: انتخاب سمت، تفویض و ورود به جای کاربر.
 * ─────────────────────────────────────────────────────────────────────────
 * مشکل قبلی: هر بخش (سربرگ، داشبورد، فهرست‌ها) هویت را جداگانه و در زمان‌های مختلف می‌خواند؛
 * سربرگ پس از رندر صفحه سمت را در localStorage عوض می‌کرد، داشبورد نام را از توکن (خود مدیر) می‌خواند،
 * نتایج جستجو در sessionStorage می‌ماند و ورود به جای کاربر فقط hash آدرس را عوض می‌کرد (بدون بارگذاری
 * دوباره). نتیجه: تا چند بار Refresh، بخشی از صفحه کاربر قبلی و بخشی کاربر جدید را نشان می‌داد.
 *
 * حالا:
 *   • پیش از رندر هر صفحه (App Initializer) سمت ذخیره‌شده با فهرست سمت‌های واقعی کاربر تطبیق داده می‌شود
 *     و اطلاعات کاربر عامل بارگذاری می‌شود؛ همه‌ی بخش‌ها از همین سرویس می‌خوانند.
 *   • هر تغییر هویت: دریافت دسترسی‌ها ← ذخیره‌ی یکجا ← پاک کردن همه‌ی داده‌های کش‌شده ← بارگذاری کامل برنامه.
 *   • ورود به جای کاربر را سرور هم مستقل راستی‌آزمایی می‌کند (فقط مدیر کل / SV_Admin / SV_Impersonate).
 */
@Injectable({ providedIn: 'root' })
export class IdentityService {
  private readonly storage = inject(LocalStorageService);
  private readonly session = inject(SessionStore);
  private readonly userService = inject(UserService);
  private readonly delegationService = inject(DelegationService);
  private readonly permissionService = inject(PermissionService);
  private readonly toast = inject(ToastService);

  private readonly _profile = signal<ActingProfile | null>(readCachedProfile());
  private readonly _options = signal<IdentityOption[]>([]);
  private readonly _switching = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly options = this._options.asReadonly();
  readonly switching = this._switching.asReadonly();

  readonly isImpersonating = computed(() => {
    this.session.userGuid(); // وابستگی واکنشی به تغییرات ذخیره‌سازی
    return this.storage.getItem(IS_IMPERSONATING) === 'true';
  });
  readonly impersonatedUserName = computed(() => (this.isImpersonating() ? this.storage.getItem(IMPERSONATED_USER_NAME) : ''));
  readonly impersonatedPositionName = computed(() => (this.isImpersonating() ? this.storage.getItem(IMPERSONATED_POSITION_NAME) : ''));

  readonly fullname = computed(() => this._profile()?.fullname ?? '');
  readonly personnelCode = computed(() => this._profile()?.userName ?? '');

  // ═══════════════════════════════════════════════════════════════
  // راه‌اندازی (App Initializer، پیش از رندر صفحه)
  // ═══════════════════════════════════════════════════════════════

  async initialize(): Promise<void> {
    if (!this.isImpersonating()) {
      await this.loadAndValidateOptions();
    }
    await this.loadProfile();
  }

  /** سمت‌های خود کاربر و تفویض‌های فعال؛ سمت ذخیره‌شده‌ی نامعتبر با سمت پیش‌فرض جایگزین می‌شود */
  private async loadAndValidateOptions(): Promise<void> {
    const tokenUser = this.session.tokenUserGuid() || this.session.userGuid();
    if (!tokenUser) return;

    let list: IdentityOption[] = [];
    try {
      const result = await firstValueFrom(this.delegationService.getActiveDelegationsForDelegatee({
        userGuid: tokenUser,
        positionGuid: this.session.positionGuid() || null,
      }));
      list = Array.isArray(result) ? (result as IdentityOption[]) : [];
    } catch (e) {
      console.error('[Identity] loading positions failed', e);
      return;
    }
    this._options.set(list);
    if (!list.length) return;

    const storedPosition = normalizeGuid(this.session.positionGuid());
    const storedUser = normalizeGuid(this.session.userGuid());
    const active = list.find(o => normalizeGuid(o.positionGuid) === storedPosition && normalizeGuid(o.userGuid) === storedUser)
      ?? list.find(o => normalizeGuid(o.positionGuid) === storedPosition)
      ?? list.find(o => !o.isDelegate)
      ?? list[0];

    const changed = normalizeGuid(active.positionGuid) !== storedPosition || normalizeGuid(active.userGuid) !== storedUser;
    this.writeIdentity(active.userGuid, active.positionGuid, active.position, active.isDelegate, active.isSuperAdmin);

    // سمت عوض شد (مثلاً تفویض منقضی شده) → دسترسی‌های همان سمت
    if (changed || !this.session.hasPermissionsLoaded()) {
      const permissions = await this.fetchPermissions(active).catch(() => null);
      if (permissions !== null) this.session.setPermissions(permissions);
    }
  }

  private async loadProfile(): Promise<void> {
    const userGuid = this.session.userGuid();
    if (!userGuid) {
      this._profile.set(null);
      return;
    }

    // نسخه‌ی کش‌شده فقط اگر متعلق به همین کاربر باشد (نمایش فوری)، سپس به‌روزرسانی
    const cached = this._profile();
    if (cached && normalizeGuid(cached.userGuid) !== normalizeGuid(userGuid)) this._profile.set(null);

    const load = (async () => {
      try {
        const info = await firstValueFrom(this.userService.getUserInformation(userGuid));
        if (!info) return;
        const profile: ActingProfile = { ...info, userGuid };
        this._profile.set(profile);
        this.storage.setItem(USER_COMPANY_ID_NAME, profile.companyGuid ?? '');
        this.storage.setItem(USER_ORGANIZATION_CHART_ID_NAME, profile.organizationChartGuid ?? '');
        if (profile.classificationLevelGuid) this.storage.setItem(USER_CLASSIFICATION_LEVEL_ID_NAME, profile.classificationLevelGuid);
        try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)); } catch { /* ignore */ }
      } catch (e) {
        console.error('[Identity] loading profile failed', e);
      }
    })();

    // اگر نسخه‌ی معتبر کش‌شده داریم منتظر شبکه نمی‌مانیم
    if (!this._profile()) await load;
  }

  // ═══════════════════════════════════════════════════════════════
  // تغییر سمت / تفویض
  // ═══════════════════════════════════════════════════════════════

  async switchTo(option: IdentityOption): Promise<void> {
    if (this.isImpersonating() || this._switching()) return;
    this._switching.set(true);
    try {
      const permissions = await this.fetchPermissions(option);
      this.writeIdentity(option.userGuid, option.positionGuid, option.position, option.isDelegate, option.isSuperAdmin);
      this.session.setPermissions(permissions);
      this.restartApp();
    } catch (e) {
      console.error('[Identity] switching position failed', e);
      this.toast.error('دریافت دسترسی‌های این سمت ممکن نشد. دوباره تلاش کنید.');
      this._switching.set(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ورود به جای کاربر
  // ═══════════════════════════════════════════════════════════════

  async impersonate(target: ImpersonationTarget): Promise<boolean> {
    if (this.isImpersonating()) {
      this.toast.warning('ابتدا از حساب فعلی خارج شوید.');
      return false;
    }
    if (!target.userGuid || !target.positionGuid) {
      this.toast.error('اطلاعات کاربر یا سمت ناقص است.');
      return false;
    }

    this._switching.set(true);
    try {
      const permissions = normalizePermissions(await firstValueFrom(this.permissionService.getPositionPermissions(target.positionGuid)));
      if (!permissions.length) {
        this.toast.error('دسترسی‌های این کاربر دریافت نشد؛ شاید مجوز «ورود به جای کاربر» را ندارید.');
        this._switching.set(false);
        return false;
      }

      this.backupOwnIdentity();
      // Main_USER_ID (کاربر توکن) عوض نمی‌شود تا سرور بداند مدیر واقعی کیست و آن را راستی‌آزمایی کند
      this.storage.setItem(USER_ID_NAME, target.userGuid);
      this.storage.setItem(POSITION_ID, target.positionGuid);
      this.storage.setItem(POSITION_NAME, target.positionName);
      this.storage.setItem(IsDeletage, 'false');
      this.storage.setItem(ISSP, 'false');
      this.session.setPermissions(permissions);
      this.storage.setItem(IS_IMPERSONATING, 'true');
      this.storage.setItem(IMPERSONATED_USER_NAME, target.userName);
      this.storage.setItem(IMPERSONATED_USER_GUID, target.userGuid);
      this.storage.setItem(IMPERSONATED_POSITION_NAME, target.positionName);

      this.restartApp();
      return true;
    } catch (e) {
      console.error('[Identity] impersonation failed', e);
      this.toast.error('ورود به جای این کاربر ممکن نشد.');
      this._switching.set(false);
      return false;
    }
  }

  exitImpersonation(reload = true): void {
    if (!this.isImpersonating()) return;
    this.restoreOwnIdentity();
    [IS_IMPERSONATING, IMPERSONATED_USER_NAME, IMPERSONATED_USER_GUID, IMPERSONATED_POSITION_NAME,
      ADMIN_USER_ID, ADMIN_POSITION_ID, ADMIN_POSITION_NAME, ADMIN_PERMISSIONS, ADMIN_MAIN_USER_ID, ADMIN_IS_DELEGATE]
      .forEach(k => this.storage.removeItem(k));
    if (reload) this.restartApp();
  }

  /** ورود تازه (SSO) در میانه‌ی ورود به جای کاربر: هویت اصلی به‌روز می‌شود، هویت هدف حفظ می‌شود */
  updateOwnIdentityBackup(userGuid: string, positionGuid: string, positionName: string, isDelegate: string): void {
    this.storage.setItem(ADMIN_USER_ID, userGuid);
    this.storage.setItem(ADMIN_MAIN_USER_ID, userGuid);
    this.storage.setItem(ADMIN_POSITION_ID, positionGuid);
    this.storage.setItem(ADMIN_POSITION_NAME, positionName);
    this.storage.setItem(ADMIN_IS_DELEGATE, isDelegate);
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  private async fetchPermissions(option: Pick<IdentityOption, 'id' | 'positionGuid' | 'isDelegate'>): Promise<string[]> {
    const raw = option.isDelegate
      ? await firstValueFrom(this.delegationService.getDelegationPermissions({ delegationId: option.id, clientId: getClientSettings().client_id }))
      : await firstValueFrom(this.permissionService.getPositionPermissions(option.positionGuid));
    return normalizePermissions(raw);
  }

  private writeIdentity(userGuid: string, positionGuid: string, positionName: string, isDelegate: boolean, isSuperAdmin: boolean): void {
    this.storage.setItem(USER_ID_NAME, userGuid);
    this.storage.setItem(POSITION_ID, positionGuid);
    this.storage.setItem(POSITION_NAME, positionName);
    this.storage.setItem(IsDeletage, String(!!isDelegate));
    this.storage.setItem(ISSP, String(!!isSuperAdmin));
  }

  private backupOwnIdentity(): void {
    this.storage.setItem(ADMIN_USER_ID, this.storage.getItem(USER_ID_NAME));
    this.storage.setItem(ADMIN_POSITION_ID, this.storage.getItem(POSITION_ID));
    this.storage.setItem(ADMIN_POSITION_NAME, this.storage.getItem(POSITION_NAME));
    this.storage.setItem(ADMIN_PERMISSIONS, this.storage.getItem(PERMISSIONS_NAME));
    this.storage.setItem(ADMIN_MAIN_USER_ID, this.storage.getItem(Main_USER_ID));
    this.storage.setItem(ADMIN_IS_DELEGATE, this.storage.getItem(IsDeletage));
    this.storage.setItem('adminIssp', this.storage.getItem(ISSP));
  }

  private restoreOwnIdentity(): void {
    const pairs: [string, string][] = [
      [ADMIN_USER_ID, USER_ID_NAME], [ADMIN_POSITION_ID, POSITION_ID], [ADMIN_POSITION_NAME, POSITION_NAME],
      [ADMIN_PERMISSIONS, PERMISSIONS_NAME], [ADMIN_MAIN_USER_ID, Main_USER_ID], [ADMIN_IS_DELEGATE, IsDeletage], ['adminIssp', ISSP],
    ];
    for (const [from, to] of pairs) {
      const value = this.storage.getItem(from);
      if (value) this.storage.setItem(to, value);
    }
    this.storage.removeItem('adminIssp');
  }

  /**
   * پاک کردن همه‌ی داده‌های وابسته به هویت قبلی و بارگذاری کامل برنامه روی داشبورد.
   * (قبلاً فقط hash آدرس عوض می‌شد و چون صفحه دوباره بارگذاری نمی‌شد «هیچ اتفاقی» نمی‌افتاد.)
   */
  restartApp(route = '/dashboard'): void {
    try { sessionStorage.clear(); } catch { /* ignore */ }
    try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
    [USER_COMPANY_ID_NAME, USER_ORGANIZATION_CHART_ID_NAME, USER_CLASSIFICATION_LEVEL_ID_NAME].forEach(k => this.storage.removeItem(k));

    const url = `${location.pathname}${location.search}#${route}`;
    history.replaceState(null, '', url);
    location.reload();
  }
}

function normalizeGuid(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/[{}]/g, '').toLowerCase();
}

function readCachedProfile(): ActingProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ActingProfile) : null;
  } catch {
    return null;
  }
}
