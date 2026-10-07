import { Injectable } from '@angular/core';
import { User, UserManager, UserManagerSettings, WebStorageStateStore } from 'oidc-client-ts';
import { environment } from '../../../environments/environment';
import { BreadcrumbService } from './breadcrumb.service';
import { LocalStorageService } from './local.storage.service';
import { normalizePermissions } from './auth-utils';
import {
    ACCESS_TOKEN_NAME, ROLE_TOKEN_NAME, USER_ID_NAME, PERMISSIONS_NAME,
    SETTINGS_NAME, DATABASAE_NAME, USER_COMPANY_ID_NAME, USER_ORGANIZATION_CHART_ID_NAME,
    USER_CURRENT_ACTIVE_SESSION_NAME, POSITION_ID, POSITION_NAME, IsDeletage, Main_USER_ID, ISSP
} from '../../core/types/configuration';

@Injectable({ providedIn: 'root' })
export class CodeFlowService {
    private readonly manager = new UserManager(getClientSettings());
    private callbackTask?: Promise<void>;
    private redirectTask?: Promise<void>;
    public user: User | null = null;

    constructor(private readonly breadcrumbService: BreadcrumbService,
        private readonly localStorageService: LocalStorageService) {
        this.manager.events.addUserLoaded(user => this.acceptUser(user));
        this.manager.events.addUserUnloaded(() => { this.user = null; this.clearLocalStorage(); });
        this.manager.events.addAccessTokenExpired(() => {
            this.localStorageService.removeItem(ACCESS_TOKEN_NAME);
        });
        // A temporary renew failure must not terminate the central SSO session.
        this.manager.events.addSilentRenewError(() => console.warn('[Auth] Silent renewal failed'));
    }

    private acceptUser(user: User): void {
        const oldId = this.localStorageService.getItem(Main_USER_ID);
        const id = String(user.profile['id'] ?? '');
        if (oldId && oldId !== id) this.clearLocalStorage();
        this.user = user;
        if (!user.expired) this.localStorageService.setItem(ACCESS_TOKEN_NAME, user.access_token);
        else this.localStorageService.removeItem(ACCESS_TOKEN_NAME);
        const profile = user.profile as Record<string, unknown>;
        const fields: [string, unknown][] = [
            [USER_ID_NAME, id], [Main_USER_ID, id],
            [POSITION_ID, profile['activatedPosition']], [POSITION_NAME, profile['positionTitle']],
            [ROLE_TOKEN_NAME, profile['position']], [IsDeletage, profile['isDelegate'] ?? false]
        ];
        const hasRole = oldId === id && this.localStorageService.exists('survey.role-context.v1');
        fields.filter(([key]) => !hasRole || key === USER_ID_NAME || key === Main_USER_ID).forEach(([key, value]) => this.localStorageService.setItem(key, String(value ?? '')));
        if (!hasRole) this.localStorageService.setItem(PERMISSIONS_NAME, JSON.stringify(normalizePermissions(profile['permission'])));
    }
    async getCurrentUser(): Promise<User | null> {
        const user = await this.manager.getUser();
        if (user) this.acceptUser(user);
        else { this.user = null; this.clearLocalStorage(); }
        return user;
    }
    async isLoggedIn(): Promise<boolean> {
        const user = await this.getCurrentUser();
        return !!user && !user.expired && !!user.access_token;
    }
    startAuthentication(forceLogin = false): Promise<void> { return this.redirect(undefined, forceLogin); }
    startSurveyAuthentication(surveyUser: string, surveyKey: string): Promise<void> {
        return this.redirect({ survey_user: surveyUser, survey_key: surveyKey });
    }
    private redirect(extraQueryParams?: Record<string, string>, forceLogin = false): Promise<void> {
        if (!this.redirectTask) this.redirectTask = this.manager.signinRedirect({ extraQueryParams, prompt: forceLogin ? 'login' : undefined })
            .finally(() => { this.redirectTask = undefined; });
        return this.redirectTask;
    }
    completeAuthentication(): Promise<void> {
        if (!this.callbackTask) {
            this.callbackTask = this.manager.signinRedirectCallback(this.callbackUrl())
                .then(user => {
                    this.localStorageService.removeItem(USER_CURRENT_ACTIVE_SESSION_NAME);
                    this.acceptUser(user);
                })
                .catch(err => {
                    console.error('[Auth] callback failed:', err?.name, err?.message, err?.error, err?.error_description);
                    this.callbackTask = undefined;
                    throw err;
                });
        }
        return this.callbackTask;
    }

    // برای حالت hash: پارامترها را از داخل hash بیرون می‌کشد
    private callbackUrl(): string {
        const { origin, pathname, search, hash } = window.location;
        if (search) return window.location.href;
        const i = hash.indexOf('?');
        return i < 0 ? window.location.href : `${origin}${pathname}${hash.slice(i)}`;
    }
    completeSilentAuthentication(): Promise<void> { return this.manager.signinSilentCallback(); }
    async signinSilent(): Promise<User | null> {
        const user = await this.manager.signinSilent();
        if (user) this.acceptUser(user);
        return user;
    }
    async logout(): Promise<void> {
        const user = await this.manager.getUser();
        this.manager.stopSilentRenew();
        await this.manager.removeUser();
        this.user = null;
        this.clearLocalStorage();
        await this.manager.signoutRedirect({ id_token_hint: user?.id_token });
    }
    getClaims(): Record<string, unknown> | undefined { return this.user?.profile as Record<string, unknown> | undefined; }
    getAuthorizationHeaderValue(): string {
        return this.user && !this.user.expired ? `${this.user.token_type} ${this.user.access_token}` : '';
    }
    getToken(): string | null {
        return this.user && !this.user.expired ? this.user.access_token : null;
    }
    private clearLocalStorage(): void {
        this.localStorageService.clearRole();
        [ACCESS_TOKEN_NAME, ROLE_TOKEN_NAME, USER_ID_NAME, PERMISSIONS_NAME, SETTINGS_NAME,
            DATABASAE_NAME, USER_COMPANY_ID_NAME, USER_ORGANIZATION_CHART_ID_NAME,
            USER_CURRENT_ACTIVE_SESSION_NAME, POSITION_ID, POSITION_NAME, IsDeletage, Main_USER_ID, ISSP]
            .forEach(key => this.localStorageService.removeItem(key));
        this.breadcrumbService.reset();
    }
}
export function getClientSettings(): UserManagerSettings {
    const base = environment.selfEndpoint.replace(/\/+$/, '');
    return {
        authority: environment.identityEndpoint,
        client_id: 'SurveyCode',
        redirect_uri: `${base}/challenge`,
        post_logout_redirect_uri: `${base}/thankyou`,
        response_type: 'code',
        response_mode: 'query',
        scope: 'openid profile UserManagementApi FileManagementApi SurveyApi',
        filterProtocolClaims: true,
        // Keep until ProfileService proves required claims are in the ID token.
        loadUserInfo: true,
        // تمدید خودکار در iframe غیرفعال است (SSO اجازه‌ی قاب نمی‌دهد و خطاهای پنهان ایجاد می‌کرد)؛
        // با انقضای توکن، اولین 401 کاربر را با حفظ مسیر به ورود مجدد می‌برد.
        silent_redirect_uri: `${base}/silent-renew`, automaticSilentRenew: false,
        userStore: new WebStorageStateStore({ store: window.sessionStorage }),
        stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
        // Diagnostic limit, not a performance fix. Coordinate with HTTP/proxy timeouts.
        requestTimeoutInSeconds: 30, silentRequestTimeoutInSeconds: 30
    };
}
