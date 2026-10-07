const ssoAuthenticationFlow: 'code' | 'password' = 'code'
// let serviceEndpoint = "http://172.17.10.60:2100";
// let userManagementEndpoint = "http://172.17.10.13:2000";
// let identityEndpoint = "http://sso.epciran.ir";
// let fileManagementEndpoint = "http://172.17.10.16:2000";
// let selfEndpoint = "http://meeting.epciran.ir";


let serviceEndpoint = "https://localhost:2301";
let userManagementEndpoint = "https://localhost:6001";
let identityEndpoint = "https://localhost:7001";
let fileManagementEndpoint = "https://localhost:4001";
let selfEndpoint = "http://localhost:4200";

export function getServiceUrl() {
    return `${serviceEndpoint}/api/`;
}
export function getFileManagementUrl() {
    return `${fileManagementEndpoint}/api/`;
}
export function getUserManagementUrl() {
    return `${userManagementEndpoint}/api/`;
}

export function getIdentityUrl() {
    return `${identityEndpoint}/api/`;
}

export function getLoginUrl() {
    return `${identityEndpoint}/connect/token`;
}

export const environment = {
    appVersion: '1.0.0',
    production: false,
    identityEndpoint,
    selfEndpoint,
    ssoAuthenticationFlow,
    fileManagementEndpoint,
    getServiceUrl,
    getFileManagementUrl,
    getUserManagementUrl,
    getIdentityUrl,
    getLoginUrl
};
