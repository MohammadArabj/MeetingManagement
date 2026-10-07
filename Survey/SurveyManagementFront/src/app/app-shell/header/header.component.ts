import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  HostListener
} from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { normalizePermissions } from '../../services/framework-services/auth-utils';
import { DELEGATION_ID, EFFECTIVE_USER_ID } from '../../services/framework-services/local.storage.service';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { environment } from '../../../environments/environment';
import { CodeFlowService, getClientSettings } from '../../services/framework-services/code-flow.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { UserService } from '../../services/user.service';
import { PermissionService } from '../../services/permission.service';
import { SwalService } from '../../services/framework-services/swal.service';
import {
  Main_USER_ID,
  IsDeletage,
  ISSP,
  PERMISSIONS_NAME,
  POSITION_ID,
  POSITION_NAME,
  USER_CLASSIFICATION_LEVEL_ID_NAME,
  USER_COMPANY_ID_NAME,
  USER_ID_NAME,
  USER_ORGANIZATION_CHART_ID_NAME
} from '../../core/types/configuration';
import { ImpersonationService } from '../../services/framework-services/impersonation.service';
import { DelegationService } from '../../services/framework-services/delegation.service';

interface UserInformation {
  fullname: string;
  companyTitle: string;
  organizationChartTitle: string;
  classificationLevel: string;
  needChangePassword: boolean;
  companyGuid: string;
  organizationChartGuid: string;
  userName: string;
  classificationLevelGuid?: string;
}

interface Delegation {
  positionGuid: string;
  userGuid: string;
  position: string;
  userName: string;
  id: number;
  isDelegate: boolean;
  isSuperAdmin: boolean;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive]
})
export class HeaderComponent implements OnInit, OnDestroy {

  // ═══════════════════════════════════════════════════════════════
  // Services
  // ═══════════════════════════════════════════════════════════════
  private readonly router = inject(Router);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly userService = inject(UserService);
  private readonly permissionService = inject(PermissionService);
  private readonly delegationService = inject(DelegationService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly impersonationService = inject(ImpersonationService);
  private readonly swalService = inject(SwalService);

  // ═══════════════════════════════════════════════════════════════
  // Impersonation (from ImpersonationService)
  // ═══════════════════════════════════════════════════════════════
  readonly isImpersonating = this.impersonationService.isImpersonating;
  readonly impersonatedUserName = this.impersonationService.impersonatedUserName;
  readonly impersonatedPositionName = this.impersonationService.impersonatedPositionName;

  // ═══════════════════════════════════════════════════════════════
  // State Signals
  // ═══════════════════════════════════════════════════════════════
  readonly information = signal<UserInformation>({
    fullname: '',
    companyTitle: '',
    organizationChartTitle: '',
    classificationLevel: '',
    needChangePassword: false,
    companyGuid: '',
    organizationChartGuid: '',
    userName: '',
    classificationLevelGuid: ''
  });

  readonly switching = signal(false);
  readonly switchError = signal('');
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  readonly isDarkMode = signal<boolean>(false);
  readonly isRoleSwitcherOpen = signal<boolean>(false);
  readonly position = signal<string>('');
  readonly selectedDelegation = signal<string>('');
  readonly isDelegate = signal<boolean>(false);
  readonly delegations = signal<Delegation[]>([]);

  // Date / Time
  readonly currentDate = signal<string>('');
  readonly currentTime = signal<string>('');
  readonly currentDay = signal<string>('');

  // ═══════════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════════
  readonly fileManagementUrl = computed(() => {
    const userName = this.information().userName;
    if (!userName) return 'assets/img/default-avatar.png';
    const photoUrl = encodeURIComponent(`photo/${userName}.jpg`);
    return `${environment.fileManagementEndpoint}/api/Image?url=${photoUrl}&w=48&q=75`;
  });

  readonly selectedDelegationKey = computed(() =>
    `${this.isDelegate() ? this.localStorageService.getItem(DELEGATION_ID) : '0'}:${this.normalizeGuid(this.selectedDelegation())}`
  );

  readonly hasMultipleDelegations = computed(() => {
    if (this.isImpersonating()) return false;
    return this.delegations().length > 0;
  });

  // ═══════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════
  ngOnInit(): void {
    if (this.isImpersonating()) {
      this.initializeForImpersonation();
    } else {
      this.initializeNormal();
    }

    this.checkDarkMode();
    this.updateDateTime();
    this.timer = setInterval(() => this.updateDateTime(), 1000);

  }
  ngOnDestroy(): void { this.destroyed = true; if (this.timer) clearInterval(this.timer); }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target instanceof Element) || !event.target.closest('.role-sw')) this.isRoleSwitcherOpen.set(false);
  }

  // ═══════════════════════════════════════════════════════════════
  // Initialization helpers
  // ═══════════════════════════════════════════════════════════════
  private initializeForImpersonation(): void {
    const positionName = this.localStorageService.getItem(POSITION_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    if (positionName) this.position.set(positionName);
    if (positionGuid) this.selectedDelegation.set(positionGuid);
    this.isDelegate.set(false);
    this.delegations.set([]);
    this.loadImpersonatedUserInfo();
  }

  private initializeNormal(): void {
    const positionName = this.localStorageService.getItem(POSITION_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const isDelegateStr = this.localStorageService.getItem(IsDeletage);
    if (positionName) this.position.set(positionName);
    if (positionGuid) this.selectedDelegation.set(positionGuid);
    this.isDelegate.set(isDelegateStr === 'true');
    this.loadUserInformation();
  }

  private loadImpersonatedUserInfo(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    if (!userGuid) return;
    this.userService.getUserInformation(userGuid).subscribe({
      next: (result: UserInformation) => {
        this.information.set(result);
        this.localStorageService.setItem(USER_COMPANY_ID_NAME, result.companyGuid);
        this.localStorageService.setItem(USER_ORGANIZATION_CHART_ID_NAME, result.organizationChartGuid);
        if (result.classificationLevelGuid) {
          this.localStorageService.setItem(USER_CLASSIFICATION_LEVEL_ID_NAME, result.classificationLevelGuid);
        }
      },
      error: (err) => console.error('[Header] Error loading impersonated user:', err)
    });
  }

  private loadUserInformation(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    if (!userGuid) return;
    this.userService.getUserInformation(userGuid).subscribe({
      next: (result: UserInformation) => {
        this.information.set(result);
        this.localStorageService.setItem(USER_COMPANY_ID_NAME, result.companyGuid);
        this.localStorageService.setItem(USER_ORGANIZATION_CHART_ID_NAME, result.organizationChartGuid);
        if (result.classificationLevelGuid) {
          this.localStorageService.setItem(USER_CLASSIFICATION_LEVEL_ID_NAME, result.classificationLevelGuid);
        }
        if (!this.isImpersonating()) {
          this.loadDelegations(userGuid);
        }
      },
      error: (err) => console.error('[Header] Error loading user info:', err)
    });
  }

  private loadDelegations(userId: string): void {
    if (this.isImpersonating()) return;

    this.delegationService.getActiveDelegationsForDelegatee({}).subscribe({
      next: (items: any) => {
        const list: Delegation[] = Array.isArray(items) ? items : [];
        this.delegations.set(list);
        const current = list.find(item => this.roleKey(item) === this.selectedDelegationKey());
        // Never silently select a different identity if the previous grant disappears.
        if (current) { void this.switchAccount(current, false); }
        else {
          this.localStorageService.removeItem(PERMISSIONS_NAME);
          this.switchError.set('سمت قبلی در دسترس نیست؛ یک سمت معتبر انتخاب کنید.');
        }
      },
      error: () => this.switchError.set('دریافت سمت‌ها انجام نشد؛ صفحه را دوباره بارگذاری کنید.')
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DateTime
  // ═══════════════════════════════════════════════════════════════
  private updateDateTime(): void {
    const now = new Date();
    this.currentDate.set(now.toLocaleDateString('fa-IR'));
    this.currentTime.set(now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
    this.currentDay.set(now.toLocaleDateString('fa-IR', { weekday: 'long' }));
  }

  // ═══════════════════════════════════════════════════════════════
  // Theme
  // ═══════════════════════════════════════════════════════════════
  toggleTheme(): void {
    this.isDarkMode.update(v => !v);
    if (this.isDarkMode()) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }

  private checkDarkMode(): void {
    if (localStorage.getItem('theme') === 'dark') {
      this.isDarkMode.set(true);
      document.body.classList.add('dark-mode');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Role Switcher
  // ═══════════════════════════════════════════════════════════════
  toggleRoleSwitcher(): void {
    if (this.isImpersonating()) return;
    this.isRoleSwitcherOpen.update(v => !v);
  }

  roleKey(item: Delegation): string {
    return `${item.isDelegate ? item.id : 0}:${this.normalizeGuid(item.positionGuid)}`;
  }
  async switchAccount(item: Delegation, reload = true): Promise<void> {
    if (this.isImpersonating() || this.switching()) return;
    if (!this.delegations().some(d => this.roleKey(d) === this.roleKey(item))) return;
    this.switching.set(true);
    this.switchError.set('');
    const actor = this.localStorageService.getItem(Main_USER_ID);
    const token = this.codeFlowService.getToken();
    try {
      const permissions = await firstValueFrom((item.isDelegate
        ? this.delegationService.getDelegationPermissions({ delegationId: item.id, clientId: getClientSettings().client_id })
        : this.permissionService.getPositionPermissions(item.positionGuid)).pipe(timeout(30000)));
      if (this.destroyed || !actor || actor !== this.localStorageService.getItem(Main_USER_ID)
        || token !== this.codeFlowService.getToken()) throw new Error('identity_changed');
      if (typeof permissions !== 'string' && !Array.isArray(permissions)) throw new Error('invalid_permissions');
      this.localStorageService.commitRole({
        [POSITION_ID]: item.positionGuid, [POSITION_NAME]: item.position,
        [IsDeletage]: String(item.isDelegate), [ISSP]: 'false',
        [DELEGATION_ID]: String(item.isDelegate ? item.id : 0),
        [EFFECTIVE_USER_ID]: item.userGuid,
        [PERMISSIONS_NAME]: JSON.stringify(normalizePermissions(permissions))
      });
      // USER_ID_NAME and Main_USER_ID remain the authenticated actor.
      // Fresh page discards requests/caches associated with the old role.
      this.selectedDelegation.set(item.positionGuid);
      this.position.set(item.position);
      this.isDelegate.set(item.isDelegate);
      if (reload) window.location.assign(this.router.serializeUrl(this.router.createUrlTree(['/dashboard'])));
    } catch {
      this.switchError.set('تغییر سمت انجام نشد؛ سمت قبلی حفظ شد. دوباره تلاش کنید.');
    } finally { this.switching.set(false); }
  }

  // ═══════════════════════════════════════════════════════════════
  // Impersonation
  // ═══════════════════════════════════════════════════════════════
  async exitImpersonation(): Promise<void> {
    const result = await this.swalService.fireSwal(
      'آیا می‌خواهید به اکانت اصلی خود بازگردید؟',
      'question'
    );
    if (result.value !== true) return;
    this.impersonationService.exitImpersonation().subscribe({
      next: (success) => {
        if (success) setTimeout(() => { window.location.href = '/dashboard'; }, 100);
      },
      error: (err) => console.error('[Header] Exit impersonation error:', err)
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Auth
  // ═══════════════════════════════════════════════════════════════
  logout(): void {
    if (this.isImpersonating()) {
      this.impersonationService.exitImpersonation().subscribe(() => this.performLogout());
    } else {
      this.performLogout();
    }
  }

  private performLogout(): void {
    if (environment.ssoAuthenticationFlow === 'code') {
      this.codeFlowService.logout();
    } else {
      this.passwordFlowService.logout();
    }
  }

  redirectToGrants(): void {
    window.location.href = `${environment.identityEndpoint}/grants/index`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════
  normalizeGuid(value: string | null | undefined): string {
    return (value ?? '').trim().replace(/[{}]/g, '').toLowerCase();
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('/assets/img/default-avatar.png')) img.src = 'assets/img/default-avatar.png';
  }
}