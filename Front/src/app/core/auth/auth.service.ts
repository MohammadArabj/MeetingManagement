import { computed, inject, Injectable, NgZone, signal } from '@angular/core';
import { User, UserManager } from 'oidc-client-ts';
import { environment } from '../../../environments/environment';
import { buildUserManagerSettings } from './auth.config';
import { SessionStore } from './session.store';

const RETURN_URL_KEY = 'meet.auth.returnUrl';
const LOGIN_ATTEMPT_KEY = 'meet.auth.loginAttempt';
const DEFAULT_RETURN_URL = '/dashboard';

/**
 * احراز هویت با SSO (IdentityServer8) از طریق oidc-client-ts.
 * ─────────────────────────────────────────────────────────────────────────
 * • init() در APP_INITIALIZER اجرا می‌شود: اگر آدرس فعلی بازگشت از SSO باشد (code/state در
 *   query یا در hash) callback پردازش و آدرس به مسیر اصلی (hash route) برگردانده می‌شود؛
 *   در غیر این صورت کاربر ذخیره‌شده بارگذاری می‌شود.
 * • هر دو حالت RedirectUri ( /challenge و /#/challenge ) پشتیبانی می‌شود.
 * • جلوی حلقه‌ی بی‌نهایت ورود (مثلاً state نامعتبر) گرفته شده است.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly zone = inject(NgZone);
  private readonly session = inject(SessionStore);
  private readonly manager = new UserManager(buildUserManagerSettings());

  private readonly _user = signal<User | null>(null);
  private loginInProgress = false;

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => {
    const u = this._user();
    return !!u && !u.expired;
  });
  readonly profile = computed(() => this._user()?.profile ?? {});

  constructor() {
    this.manager.events.addUserLoaded(u => this.zone.run(() => this.setUser(u)));
    this.manager.events.addUserUnloaded(() => this.zone.run(() => this._user.set(null)));
    this.manager.events.addAccessTokenExpired(() => this.zone.run(() => {
      this._user.set(null);
      this.login(currentRoute());
    }));
  }

  /** فراخوانی در APP_INITIALIZER. خروجی: آیا یک ورود تازه انجام شد؟ */
  async init(): Promise<{ freshLogin: boolean }> {
    const callbackUrl = detectCallbackUrl();
    if (callbackUrl) {
      try {
        const user = await this.manager.signinRedirectCallback(callbackUrl);
        this.setUser(user);
        sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);

        const state = (user.state ?? {}) as { returnUrl?: string };
        const returnUrl = sanitizeReturnUrl(state.returnUrl ?? sessionStorage.getItem(RETURN_URL_KEY));
        sessionStorage.removeItem(RETURN_URL_KEY);
        replaceLocation(returnUrl);
        return { freshLogin: true };
      } catch (error) {
        console.error('[Auth] signin callback failed', error);
        replaceLocation(DEFAULT_RETURN_URL);
        await this.manager.removeUser();
        // ورود مجدد فقط یک بار؛ برای جلوگیری از حلقه
        if (!sessionStorage.getItem(LOGIN_ATTEMPT_KEY)) {
          sessionStorage.setItem(LOGIN_ATTEMPT_KEY, '1');
          await this.login(DEFAULT_RETURN_URL);
        }
        return { freshLogin: false };
      }
    }

    const stored = await this.manager.getUser();
    if (stored && !stored.expired) this.setUser(stored);
    else if (stored) await this.manager.removeUser();
    await this.manager.clearStaleState();
    return { freshLogin: false };
  }

  /** هدایت به SSO؛ مسیر فعلی (hash route) پس از بازگشت بازیابی می‌شود. */
  async login(returnUrl: string = currentRoute()): Promise<void> {
    if (this.loginInProgress) return;
    this.loginInProgress = true;
    const safe = sanitizeReturnUrl(returnUrl);
    sessionStorage.setItem(RETURN_URL_KEY, safe);
    await this.manager.signinRedirect({ state: { returnUrl: safe } });
  }

  /** خروج کامل (SSO + محلی) */
  async logout(): Promise<void> {
    const user = this._user() ?? (await this.manager.getUser());
    this.session.clear();
    this._user.set(null);
    try {
      if (user) {
        await this.manager.signoutRedirect({ id_token_hint: user.id_token });
        return;
      }
    } catch (error) {
      console.error('[Auth] signout failed', error);
    }
    await this.manager.removeUser();
    await this.login(DEFAULT_RETURN_URL);
  }

  accessToken(): string | null {
    const u = this._user();
    return u && !u.expired ? u.access_token : null;
  }

  /** آیا URL به یکی از API های خودمان است؟ (توکن هرگز به آدرس دیگری ارسال نمی‌شود) */
  isApiUrl(url: string): boolean {
    return environment.apiEndpoints.some(e => url.startsWith(e));
  }

  private setUser(user: User): void {
    this._user.set(user);
    this.session.setAccessToken(user.access_token);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** مسیر فعلی روتر (hash) بدون # */
export function currentRoute(): string {
  const hash = window.location.hash;
  return hash.startsWith('#') ? hash.slice(1) || DEFAULT_RETURN_URL : DEFAULT_RETURN_URL;
}

function sanitizeReturnUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('challenge') || url === '/') {
    return DEFAULT_RETURN_URL;
  }
  return url;
}

/**
 * تشخیص بازگشت از SSO.
 * حالت ۱: http://host/challenge?code=..&state=..        (RedirectUri فعلی SSO)
 * حالت ۲: http://host/#/challenge?code=..&state=..      (RedirectUri قدیمی)
 * خروجی: URL قابل پردازش توسط oidc-client-ts یا null
 */
function detectCallbackUrl(): string | null {
  const { origin, pathname, search, hash } = window.location;
  const hasParams = (q: string) => /[?&](code|error)=/.test(q) && /[?&]state=/.test(q);

  if (hasParams(search)) return `${origin}${pathname}${search}`;

  const queryIndex = hash.indexOf('?');
  if (hash.startsWith('#/challenge') && queryIndex > 0) {
    const query = hash.slice(queryIndex);
    if (hasParams(query)) return `${origin}${pathname}${query}`;
  }
  return null;
}

/** پاک کردن code/state از نوار آدرس و رفتن به مسیر hash مقصد (بدون reload) */
function replaceLocation(route: string): void {
  const base = document.querySelector('base')?.getAttribute('href') ?? '/';
  window.history.replaceState(null, '', `${base}#${route}`);
}
