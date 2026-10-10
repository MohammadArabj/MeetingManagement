// ═══════════════════════════════════════════════════════════════════════════
//  محیط توسعه — ساختار دقیقاً مطابق سامانه مدیریت جلسات
// ═══════════════════════════════════════════════════════════════════════════
const ssoAuthenticationFlow: 'code' | 'password' = 'code';

const serviceEndpoint = "https://localhost:2301";
const userManagementEndpoint = "https://localhost:6001";
const identityEndpoint = "https://localhost:7001";
const fileManagementEndpoint = "https://localhost:4001";
const selfEndpoint = "http://localhost:4200";

export function getServiceUrl() { return `${serviceEndpoint}/api/`; }
export function getFileManagementUrl() { return `${fileManagementEndpoint}/api/`; }
export function getUserManagementUrl() { return `${userManagementEndpoint}/api/`; }
export function getIdentityUrl() { return `${identityEndpoint}/api/`; }
export function getLoginUrl() { return `${identityEndpoint}/connect/token`; }

export const environment = {
    appVersion: '2.0.0',
    production: false,
    identityEndpoint,
    selfEndpoint,
    ssoAuthenticationFlow,
    fileManagementEndpoint,
    getServiceUrl,
    getFileManagementUrl,
    getUserManagementUrl,
    getIdentityUrl,
    getLoginUrl,

    /** تنظیمات OIDC (oidc-client-ts + PKCE). کلاینت در SSO public است؛ secret لازم نیست. */
    auth: {
        clientId: 'SurveyCode',
        scope: 'openid profile UserManagementApi FileManagementApi SurveyApi',
        /** باید دقیقاً با RedirectUris ثبت‌شده در SSO یکی باشد: {system.Url}/challenge */
        redirectPath: '/challenge',
        /** فاصله بررسی نشست SSO (میلی‌ثانیه) */
        sessionCheckIntervalMs: 120_000,
    },

    /** سرویس‌هایی که توکن به آن‌ها ارسال می‌شود (هیچ‌وقت توکن به آدرس دیگری فرستاده نمی‌شود) */
    apiEndpoints: [serviceEndpoint, userManagementEndpoint, identityEndpoint, fileManagementEndpoint],
};
