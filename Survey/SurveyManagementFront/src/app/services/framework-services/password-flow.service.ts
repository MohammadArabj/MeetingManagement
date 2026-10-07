import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CodeFlowService } from './code-flow.service';
import { LocalStorageService } from './local.storage.service';
import { PERMISSIONS_NAME } from '../../core/types/configuration';
import { normalizePermissions } from './auth-utils';
/** Compatibility adapter. Password grant is intentionally disabled; use Code + PKCE. */
@Injectable({ providedIn: 'root' })
export class PasswordFlowService {
    readonly isLoading$ = of(false);
    constructor(private readonly auth: CodeFlowService, private readonly storage: LocalStorageService,
        private readonly router: Router) { }
    authenticate(_username: string, _password: string, _dbName: string) {
        return throwError(() => new Error('Password grant حذف شده است؛ از CodeFlowService.startAuthentication استفاده کنید.'));
    }
    navigateToDashboard(showSessions = false) { return this.router.navigateByUrl(showSessions ? '/dashboard/sessions' : '/dashboard'); }
    logout(): Promise<void> { return this.auth.logout(); }
    isLoggedIn(): boolean { return !!this.auth.user && !this.auth.user.expired; }
    getToken(): string | null { return this.auth.getToken(); }
    async checkPermission(needed: string | string[]): Promise<boolean> {
        const required = Array.isArray(needed) ? needed : [needed];
        if (!required.length || !needed) return true;
        const available = normalizePermissions(this.getPermissions());
        return required.some(p => available.includes(p));
    }
    hasNoAnyPermissions(): boolean { return normalizePermissions(this.getPermissions()).length === 0; }
    getPermissions(): string | null { return this.storage.getItem(PERMISSIONS_NAME); }
}
