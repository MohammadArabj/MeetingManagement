// header/header.component.ts

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { environment } from '../../../environments/environment';
import { CodeFlowService, getClientSettings } from '../../services/framework-services/code-flow.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { SidebarService } from '../../services/framework-services/sidebar.service';
import { DelegationService } from '../../services/delegation.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { UserService } from '../../services/user.service';
import { PermissionService } from '../../services/permission.service';
import { SwalService } from '../../services/framework-services/swal.service';
import {
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
import { NotificationBellComponent } from './notification-bell/notification-bell.component';
import { HelpService } from '../../core/help/help.service';
import { ThemeService } from '../../core/theme/theme.service';
import { mediaTokenParam } from '../../core/media/media-token';

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
  id: string;
  isDelegate: boolean;
  isSuperAdmin: boolean;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  standalone: true,
  imports: [CommonModule, NotificationBellComponent]
})
export class HeaderComponent implements OnInit {
  // ═══════════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════════
  private readonly router = inject(Router);
  readonly help = inject(HelpService);
  readonly theme = inject(ThemeService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly sidebarService = inject(SidebarService);
  private readonly delegationService = inject(DelegationService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly userService = inject(UserService);
  private readonly permissionService = inject(PermissionService);
  private readonly impersonationService = inject(ImpersonationService);
  private readonly swalService = inject(SwalService);

  // ═══════════════════════════════════════════════════════════════
  // Impersonation Signals
  // ═══════════════════════════════════════════════════════════════
  readonly isImpersonating = this.impersonationService.isImpersonating;
  readonly impersonatedUserName = this.impersonationService.impersonatedUserName;
  readonly impersonatedPositionName = this.impersonationService.impersonatedPositionName;

  // ═══════════════════════════════════════════════════════════════
  // State Signals
  // ═══════════════════════════════════════════════════════════════
  currentDate = signal<string>('');
  currentTime = signal<string>('');
  currentDay = signal<string>('');
  isRoleSwitcherOpen = signal<boolean>(false);
  position = signal<string>('');
  selectedDelegation = signal<string>('');
  isDelegate = signal<boolean>(false);
  delegations = signal<Delegation[]>([]);
  information = signal<UserInformation>({
    fullname: '',
    companyTitle: '',
    organizationChartTitle: '',
    classificationLevel: '',
    needChangePassword: false,
    companyGuid: '',
    organizationChartGuid: '',
    userName: ''
  });

  // ═══════════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════════
  readonly selectedDelegationKey = computed(() => this.normalizeGuid(this.selectedDelegation()));

  readonly fileManagementUrl = computed(() => {
    const userName = this.information().userName;
    if (!userName) return 'img/default-avatar.png';

    const photoUrl = encodeURIComponent(`photo/${userName}.jpg`);
    return `${environment.fileManagementEndpoint}/api/Image?url=${photoUrl}&w=96${mediaTokenParam()}`;
  });

  readonly avatarStyle = computed(() => {
    return `url(${this.fileManagementUrl()}), url(img/default-avatar.png)`;
  });

  // در حالت impersonation، role switcher غیرفعال است
  readonly hasMultipleDelegations = computed(() => {
    if (this.isImpersonating()) return false;
    return this.delegations().length > 1;
  });

  // ═══════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════
  ngOnInit(): void {
    console.log('[Header] ngOnInit - isImpersonating:', this.isImpersonating());

    // اول چک کن که آیا impersonating هستیم
    if (this.isImpersonating()) {
      this.initializeForImpersonation();
    } else {
      this.initializeNormal();
    }

    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);

    // بستن dropdown با کلیک خارج از آن
    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.role-switcher')) {
        this.isRoleSwitcherOpen.set(false);
      }
    });
  }

  /**
   * مقداردهی اولیه در حالت Impersonation
   */
  private initializeForImpersonation(): void {
    console.log('[Header] Initializing for impersonation mode');

    // خواندن مستقیم از localStorage
    const positionName = this.localStorageService.getItem(POSITION_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);

    console.log('[Header] Impersonation - Position:', positionName, positionGuid);

    if (positionName) this.position.set(positionName);
    if (positionGuid) this.selectedDelegation.set(positionGuid);
    this.isDelegate.set(false);

    // Delegations خالی باشد در حالت impersonation
    this.delegations.set([]);

    // لود اطلاعات کاربر impersonate شده
    this.loadImpersonatedUserInfo();
  }

  /**
   * مقداردهی اولیه در حالت عادی
   */
  private initializeNormal(): void {
    console.log('[Header] Initializing for normal mode');

    this.initializeFromStorage();
    this.loadUserInformation();
  }

  private initializeFromStorage(): void {
    const positionName = this.localStorageService.getItem(POSITION_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const isDelegateStr = this.localStorageService.getItem(IsDeletage);

    if (positionName) this.position.set(positionName);
    if (positionGuid) this.selectedDelegation.set(positionGuid);
    this.isDelegate.set(isDelegateStr === 'true');
  }

  /**
   * لود اطلاعات کاربر impersonate شده
   */
  private loadImpersonatedUserInfo(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    if (!userGuid) return;

    console.log('[Header] Loading impersonated user info:', userGuid);

    this.userService.getUserInformation(userGuid).subscribe({
      next: (result: UserInformation) => {
        console.log('[Header] Impersonated user info loaded:', result.fullname);
        this.information.set(result);

        // ذخیره اطلاعات شرکت
        this.localStorageService.setItem(USER_COMPANY_ID_NAME, result.companyGuid);
        this.localStorageService.setItem(USER_ORGANIZATION_CHART_ID_NAME, result.organizationChartGuid);
        if (result.classificationLevelGuid) {
          this.localStorageService.setItem(USER_CLASSIFICATION_LEVEL_ID_NAME, result.classificationLevelGuid);
        }

        // ⚠️ مهم: در حالت impersonation، loadDelegations را صدا نزن!
      },
      error: (error) => console.error('[Header] Error loading impersonated user info:', error)
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

        // ⚠️ فقط در حالت عادی delegations را لود کن
        if (!this.isImpersonating()) {
          this.loadDelegations(userGuid);
        }
      },
      error: (error) => console.error('Error loading user information:', error)
    });
  }

  public normalizeGuid(value: string | null | undefined): string {
    return (value ?? '').trim().replace(/[{}]/g, '').toLowerCase();
  }

  private loadDelegations(userId: string): void {
    // ⚠️ در حالت impersonation این متد نباید اجرا شود
    if (this.isImpersonating()) {
      console.log('[Header] Skipping loadDelegations - impersonating');
      return;
    }

    const storedPositionGuidRaw = this.localStorageService.getItem(POSITION_ID);
    const storedPositionGuid = this.normalizeGuid(storedPositionGuidRaw);

    const request = { userGuid: userId, positionGuid: storedPositionGuidRaw };

    this.delegationService.getActiveDelegationsForDelegatee(request).subscribe({
      next: (delegations: any) => {
        const list = Array.isArray(delegations) ? delegations : [];
        this.delegations.set(list.length > 1 ? list : []);

        if (list.length > 0) {
          const matched = list.find((d: Delegation) => this.normalizeGuid(d.positionGuid) === storedPositionGuid);
          const active = matched ?? list[0];

          this.selectedDelegation.set(active.positionGuid);
          this.position.set(active.position);
          this.isDelegate.set(active.isDelegate);

          this.localStorageService.setItem(POSITION_ID, active.positionGuid);
          this.localStorageService.setItem(POSITION_NAME, active.position);
          this.localStorageService.setItem(IsDeletage, active.isDelegate.toString());
          this.localStorageService.setItem(ISSP, active.isSuperAdmin.toString());
          this.localStorageService.setItem(USER_ID_NAME, active.userGuid);
        }
      },
      error: (error) => {
        console.error('Error loading delegations:', error);
        this.delegations.set([]);
      }
    });
  }

  updateDateTime(): void {
    const now = new Date();
    this.currentDate.set(now.toLocaleDateString('fa-IR'));
    this.currentTime.set(now.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit'
    }));
    this.currentDay.set(now.toLocaleDateString('fa-IR', { weekday: 'long' }));
  }

  // ═══════════════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════════════

  toggle(): void {
    this.sidebarService.toggleSidebar();
  }

  toggleRoleSwitcher(): void {
    if (this.isImpersonating()) return;
    this.isRoleSwitcherOpen.update(open => !open);
  }

  switchAccount(item: Delegation): void {
    if (this.isImpersonating()) return;

    this.selectedDelegation.set(item.positionGuid);
    this.position.set(item.position);
    this.isDelegate.set(item.isDelegate);
    this.isRoleSwitcherOpen.set(false);

    this.localStorageService.setItem(USER_ID_NAME, item.userGuid);
    this.localStorageService.setItem(POSITION_ID, item.positionGuid);
    this.localStorageService.setItem(POSITION_NAME, item.position);
    this.localStorageService.setItem(IsDeletage, item.isDelegate.toString());
    this.localStorageService.setItem(ISSP, item.isSuperAdmin.toString());

    this.getPermissions(item.positionGuid, item.id, item.isDelegate);
  }

  private getPermissions(positionGuid: string, delegationId: string, isDelegate: boolean): void {
    if (isDelegate) {
      const request = {
        delegationId: delegationId,
        clientId: getClientSettings().client_id
      };

      this.delegationService.getDelegationPermissions(request).subscribe({
        next: permissions => this.updatePermissionsAndNavigate(permissions),
        error: () => this.codeFlowService.logout(),
      });
    } else {
      this.permissionService.getPositionPermissions(positionGuid).subscribe({
        next: permissions => this.updatePermissionsAndNavigate(permissions),
        error: () => this.codeFlowService.logout(),
      });
    }
  }

  private updatePermissionsAndNavigate(permissions: any): void {
    this.localStorageService.removeItem(PERMISSIONS_NAME);
    this.localStorageService.setItem(PERMISSIONS_NAME, permissions);
    this.router.navigateByUrl('/#/dashboard');
    location.reload();
  }

  // ═══════════════════════════════════════════════════════════════
  // Exit Impersonation
  // ═══════════════════════════════════════════════════════════════

  async exitImpersonation(): Promise<void> {
    const result = await this.swalService.fireSwal(
      'آیا می‌خواهید به حساب اصلی خود بازگردید؟',''
    );

    if (result.value !== true) return;

    // ✅ چون exitImpersonation فقط localStorage را تغییر می‌دهد،
    // می‌توانیم مستقیم reload کنیم
    this.impersonationService.exitImpersonation().subscribe({
      next: (success) => {
        if (success) {
          // ✅ کمی صبر کن
          setTimeout(() => {
            window.location.href = '/#/dashboard';
            window.location.reload();
          }, 100);
        }
      },
      error: (error) => {
        console.error('Exit impersonation error:', error);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Logout
  // ═══════════════════════════════════════════════════════════════

  logout(): void {
    if (this.isImpersonating()) {
      this.impersonationService.exitImpersonation().subscribe(() => {
        this.performLogout();
      });
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

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'img/default-avatar.png';
  }
}
