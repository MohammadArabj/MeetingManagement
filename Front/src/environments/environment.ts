
// ═══════════════════════════════════════════════════════════════════════════
//  محیط توسعه
// ═══════════════════════════════════════════════════════════════════════════
const ssoAuthenticationFlow: 'code' | 'password' = 'code';

const serviceEndpoint = "https://localhost:8001";
const userManagementEndpoint = "https://localhost:6001";
const identityEndpoint = "https://localhost:7001";
const fileManagementEndpoint = "https://localhost:4001";
const selfEndpoint = "http://localhost:4200";

const systemGuid = 'd4498b9d-fe54-4c65-b1d3-35022dab7dbb';
const boardCategoryGuid = 'fa370076-d2a9-4546-b00c-71de1a370306';
const defaultFollowerGuid = '78bb455B-F24b-42cf-86b6-f616076ca722';
const defaultFollowerPositionGuid = 'f1f5b492-34a1-4e18-bdcf-9d7948094207';
const committeeGuid = 'ea232fb3-08ae-402b-9fd6-f7758965e410';

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
    systemGuid,
    ssoAuthenticationFlow,
    fileManagementEndpoint,
    boardCategoryGuid,
    defaultFollowerGuid,
    defaultFollowerPositionGuid,
    committeeGuid,
    getServiceUrl,
    getFileManagementUrl,
    getUserManagementUrl,
    getIdentityUrl,
    getLoginUrl,

    /** تنظیمات OIDC (oidc-client-ts + PKCE). کلاینت در SSO public است؛ secret لازم نیست. */
    auth: {
        clientId: 'MeetManage',
        scope: 'openid profile UserManagementApi FileManagementApi MeetApi',
        /** باید دقیقاً با RedirectUris ثبت‌شده در SSO یکی باشد: {system.Url}/challenge */
        redirectPath: '/#/challenge',
        /** فاصله بررسی نشست SSO (میلی‌ثانیه) */
        sessionCheckIntervalMs: 120_000,
    },

    /** سرویس‌هایی که توکن به آن‌ها ارسال می‌شود (هیچ‌وقت توکن به آدرس دیگری فرستاده نمی‌شود) */
    apiEndpoints: [serviceEndpoint, userManagementEndpoint, identityEndpoint, fileManagementEndpoint],
};
