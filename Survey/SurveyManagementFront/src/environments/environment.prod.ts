const ssoAuthenticationFlow: 'code' | 'password' = 'code'
let serviceEndpoint = "https://172.18.10.22:2300";
let userManagementEndpoint = "https://172.18.10.22:6003";
let identityEndpoint = "https://172.18.10.22:6005";
let fileManagementEndpoint = "https://172.18.10.22:9001";
let selfEndpoint = "http://172.18.10.22:2030";


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
