import { UserManagerSettings, WebStorageStateStore } from 'oidc-client-ts';
import { environment } from '../../../environments/environment';

/** آدرس بازگشت از SSO؛ باید با RedirectUris کلاینت در SSO یکسان باشد. */
export function getRedirectUri(): string {
  return `${environment.selfEndpoint}${environment.auth.redirectPath}`;
}

/**
 * تنظیمات oidc-client-ts
 * ─────────────────────────────────────────────────────────────────────────
 * • Authorization Code + PKCE (پیش‌فرض oidc-client-ts) — کلاینت در SSO با RequireClientSecret=false
 *   تعریف شده؛ قبلاً client_secret داخل باندل جاوااسکریپت بود که هم ناامن بود و هم بی‌اثر.
 * • توکن در localStorage با پیشوند اختصاصی نگه‌داری می‌شود تا تب‌های دیگر هم لاگین بمانند
 *   (شبکه داخلی؛ در صورت نیاز به امنیت بیشتر به sessionStorage تغییر دهید).
 * • Silent renew غیرفعال است چون در SSO آدرس silent_redirect_uri ثبت نشده و Refresh Token
 *   هم فعال نیست؛ با انقضای توکن کاربر با حفظ مسیر فعلی دوباره به SSO هدایت می‌شود (بدون
 *   وارد کردن رمز، چون کوکی SSO معتبر است).
 */
export function buildUserManagerSettings(): UserManagerSettings {
  return {
    authority: environment.identityEndpoint,
    client_id: environment.auth.clientId,
    redirect_uri: getRedirectUri(),
    post_logout_redirect_uri: environment.selfEndpoint,
    response_type: 'code',
    scope: environment.auth.scope,
    loadUserInfo: true,
    filterProtocolClaims: true,
    automaticSilentRenew: false,
    monitorSession: false,
    accessTokenExpiringNotificationTimeInSeconds: 120,
    userStore: new WebStorageStateStore({ store: window.localStorage, prefix: 'meet.oidc.user.' }),
    stateStore: new WebStorageStateStore({ store: window.localStorage, prefix: 'meet.oidc.state.' }),
  };
}

/** برای سازگاری با کدهای قدیمی که getClientSettings().client_id را می‌خوانند. */
export function getClientSettings(): { client_id: string; authority: string; redirect_uri: string } {
  return {
    client_id: environment.auth.clientId,
    authority: environment.identityEndpoint,
    redirect_uri: getRedirectUri(),
  };
}
