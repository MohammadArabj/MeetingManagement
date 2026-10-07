// services/impersonation.service.ts

import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { tap, switchMap, catchError, finalize, delay } from 'rxjs/operators';
import { IS_IMPERSONATING, IMPERSONATED_USER_NAME, IMPERSONATED_USER_GUID, IMPERSONATED_POSITION_NAME, USER_ID_NAME, POSITION_ID, POSITION_NAME, Main_USER_ID, IsDeletage, PERMISSIONS_NAME, ADMIN_USER_ID, ADMIN_POSITION_ID, ADMIN_POSITION_NAME, ADMIN_PERMISSIONS, ADMIN_MAIN_USER_ID, ADMIN_IS_DELEGATE } from '../../core/types/configuration';
import { PermissionService } from '../permission.service';
import { LocalStorageService } from './local.storage.service';
import { ToastService } from './toast.service';


export interface ImpersonationTarget {
    userGuid: string;
    positionGuid: string;
    userName: string;
    positionName: string;
    persNo?: string;
}

export interface ImpersonationState {
    isImpersonating: boolean;
    impersonatedUserName: string;
    impersonatedUserGuid: string;
    impersonatedPositionName: string;
}

@Injectable({
    providedIn: 'root'
})
export class ImpersonationService {

    private readonly localStorageService = inject(LocalStorageService);
    private readonly permissionService = inject(PermissionService);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);

    // ═══════════════════════════════════════════════════════════════
    // Signals
    // ═══════════════════════════════════════════════════════════════
    private readonly _isImpersonating = signal<boolean>(false);
    private readonly _impersonatedUserName = signal<string>('');
    private readonly _impersonatedUserGuid = signal<string>('');
    private readonly _impersonatedPositionName = signal<string>('');

    readonly isImpersonating = this._isImpersonating.asReadonly();
    readonly impersonatedUserName = this._impersonatedUserName.asReadonly();
    readonly impersonatedUserGuid = this._impersonatedUserGuid.asReadonly();
    readonly impersonatedPositionName = this._impersonatedPositionName.asReadonly();

    readonly state = computed<ImpersonationState>(() => ({
        isImpersonating: this._isImpersonating(),
        impersonatedUserName: this._impersonatedUserName(),
        impersonatedUserGuid: this._impersonatedUserGuid(),
        impersonatedPositionName: this._impersonatedPositionName()
    }));

    constructor() {
        this.initializeFromStorage();
    }

    private initializeFromStorage(): void {
        const isImpersonating = this.localStorageService.getItem(IS_IMPERSONATING) === 'true';

        if (isImpersonating) {
            const impersonatedUserName = this.localStorageService.getItem(IMPERSONATED_USER_NAME) || '';
            const impersonatedUserGuid = this.localStorageService.getItem(IMPERSONATED_USER_GUID) || '';
            const impersonatedPositionName = this.localStorageService.getItem(IMPERSONATED_POSITION_NAME) || '';

            this._isImpersonating.set(true);
            this._impersonatedUserName.set(impersonatedUserName);
            this._impersonatedUserGuid.set(impersonatedUserGuid);
            this._impersonatedPositionName.set(impersonatedPositionName);
        } else {
            this._isImpersonating.set(false);
            this._impersonatedUserName.set('');
            this._impersonatedUserGuid.set('');
            this._impersonatedPositionName.set('');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Impersonate User
    // ═══════════════════════════════════════════════════════════════

    impersonate(target: ImpersonationTarget): Observable<boolean> {
        console.log('[ImpersonationService] Starting impersonation:', target);

        if (this._isImpersonating()) {
            this.toastService.warning('ابتدا از حساب فعلی خارج شوید');
            return of(false);
        }

        if (!target.userGuid || !target.positionGuid) {
            this.toastService.error('اطلاعات کاربر ناقص است');
            return of(false);
        }

        // ✅ ابتدا backup کن
        this.backupAdminState();

        return this.loadUserPermissions(target.positionGuid).pipe(
            tap(permissions => {
                console.log('[ImpersonationService] Permissions loaded successfully');

                // ═══════════════════════════════════════════════════════════
                // ذخیره اطلاعات کاربر impersonate شده
                // ═══════════════════════════════════════════════════════════
                this.localStorageService.setItem(USER_ID_NAME, target.userGuid);
                this.localStorageService.setItem(POSITION_ID, target.positionGuid);
                this.localStorageService.setItem(POSITION_NAME, target.positionName);
                this.localStorageService.setItem(Main_USER_ID, target.userGuid);
                this.localStorageService.setItem(IsDeletage, 'false');

                // ذخیره دسترسی‌های جدید
                this.localStorageService.removeItem(PERMISSIONS_NAME);
                this.localStorageService.setItem(PERMISSIONS_NAME, permissions);

                // تنظیم وضعیت impersonation
                this.localStorageService.setItem(IS_IMPERSONATING, 'true');
                this.localStorageService.setItem(IMPERSONATED_USER_NAME, target.userName);
                this.localStorageService.setItem(IMPERSONATED_USER_GUID, target.userGuid);
                this.localStorageService.setItem(IMPERSONATED_POSITION_NAME, target.positionName);

                // آپدیت signals
                this._isImpersonating.set(true);
                this._impersonatedUserName.set(target.userName);
                this._impersonatedUserGuid.set(target.userGuid);
                this._impersonatedPositionName.set(target.positionName);

                this.toastService.success(`ورود به عنوان "${target.userName}" انجام شد`);
            }),
            // ✅ صبر کن تا همه چیز کامل شود
            switchMap(() => of(true)),
            catchError(error => {
                console.error('[ImpersonationService] Error during impersonation:', error);
                this.toastService.error('خطا در ورود به عنوان کاربر');
                this.restoreAdminState();
                return of(false);
            })
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // Exit Impersonation - ✅ اصلاح شده
    // ═══════════════════════════════════════════════════════════════

    exitImpersonation(): Observable<boolean> {
        console.log('[ImpersonationService] Exiting impersonation...');

        if (!this._isImpersonating()) {
            console.log('[ImpersonationService] Not impersonating, nothing to exit');
            return of(false);
        }

        try {
            // ✅ فقط localStorage را آپدیت کن - بدون API call
            this.restoreAdminState();
            this.clearImpersonationState();

            console.log('[ImpersonationService] Exit complete');
            this.toastService.success('بازگشت به اکانت اصلی انجام شد');

            return of(true);
        } catch (error) {
            console.error('[ImpersonationService] Error exiting impersonation:', error);
            this.toastService.error('خطا در بازگشت به اکانت اصلی');
            return of(false);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Private Methods
    // ═══════════════════════════════════════════════════════════════

    private backupAdminState(): void {
        const currentUserId = this.localStorageService.getItem(USER_ID_NAME);
        const currentPositionId = this.localStorageService.getItem(POSITION_ID);
        const currentPositionName = this.localStorageService.getItem(POSITION_NAME);
        const currentPermissions = this.localStorageService.getItem(PERMISSIONS_NAME);
        const currentMainUserId = this.localStorageService.getItem(Main_USER_ID);
        const currentIsDelegate = this.localStorageService.getItem(IsDeletage);

        this.localStorageService.setItem(ADMIN_USER_ID, currentUserId);
        this.localStorageService.setItem(ADMIN_POSITION_ID, currentPositionId);
        this.localStorageService.setItem(ADMIN_POSITION_NAME, currentPositionName);
        this.localStorageService.setItem(ADMIN_PERMISSIONS, currentPermissions);
        this.localStorageService.setItem(ADMIN_MAIN_USER_ID, currentMainUserId);
        this.localStorageService.setItem(ADMIN_IS_DELEGATE, currentIsDelegate);
    }

    private restoreAdminState(): void {
        const adminUserId = this.localStorageService.getItem(ADMIN_USER_ID);
        const adminPositionId = this.localStorageService.getItem(ADMIN_POSITION_ID);
        const adminPositionName = this.localStorageService.getItem(ADMIN_POSITION_NAME);
        const adminPermissions = this.localStorageService.getItem(ADMIN_PERMISSIONS);
        const adminMainUserId = this.localStorageService.getItem(ADMIN_MAIN_USER_ID);
        const adminIsDelegate = this.localStorageService.getItem(ADMIN_IS_DELEGATE);

        if (adminUserId) this.localStorageService.setItem(USER_ID_NAME, adminUserId);
        if (adminPositionId) this.localStorageService.setItem(POSITION_ID, adminPositionId);
        if (adminPositionName) this.localStorageService.setItem(POSITION_NAME, adminPositionName);
        if (adminMainUserId) this.localStorageService.setItem(Main_USER_ID, adminMainUserId);
        if (adminIsDelegate) this.localStorageService.setItem(IsDeletage, adminIsDelegate);

        if (adminPermissions) {
            this.localStorageService.removeItem(PERMISSIONS_NAME);
            this.localStorageService.setItem(PERMISSIONS_NAME, adminPermissions);
        }
    }

    private clearImpersonationState(): void {
        this.localStorageService.removeItem(IS_IMPERSONATING);
        this.localStorageService.removeItem(IMPERSONATED_USER_NAME);
        this.localStorageService.removeItem(IMPERSONATED_USER_GUID);
        this.localStorageService.removeItem(IMPERSONATED_POSITION_NAME);

        this.localStorageService.removeItem(ADMIN_USER_ID);
        this.localStorageService.removeItem(ADMIN_POSITION_ID);
        this.localStorageService.removeItem(ADMIN_POSITION_NAME);
        this.localStorageService.removeItem(ADMIN_PERMISSIONS);
        this.localStorageService.removeItem(ADMIN_MAIN_USER_ID);
        this.localStorageService.removeItem(ADMIN_IS_DELEGATE);

        this._isImpersonating.set(false);
        this._impersonatedUserName.set('');
        this._impersonatedUserGuid.set('');
        this._impersonatedPositionName.set('');
    }

    private loadUserPermissions(positionGuid: string): Observable<any> {
        return this.permissionService.getPositionPermissions(positionGuid);
    }

    checkIsImpersonating(): boolean {
        return this.localStorageService.getItem(IS_IMPERSONATING) === 'true';
    }

    getImpersonatedUserName(): string {
        return this.localStorageService.getItem(IMPERSONATED_USER_NAME) || '';
    }

    getImpersonatedPositionName(): string {
        return this.localStorageService.getItem(IMPERSONATED_POSITION_NAME) || '';
    }

    getAdminPositionName(): string {
        return this.localStorageService.getItem(ADMIN_POSITION_NAME) || '';
    }

    refreshState(): void {
        this.initializeFromStorage();
    }
}