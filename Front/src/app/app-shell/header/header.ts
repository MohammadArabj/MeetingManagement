// header/header.component.ts

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { environment } from '../../../environments/environment';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { SidebarService } from '../../services/framework-services/sidebar.service';
import { SwalService } from '../../services/framework-services/swal.service';
import { NotificationBellComponent } from './notification-bell/notification-bell.component';
import { HelpService } from '../../core/help/help.service';
import { ThemeService } from '../../core/theme/theme.service';
import { userPhotoUrl } from '../../core/media/media-token';
import { IdentityService } from '../../core/auth/identity.service';
import { SessionStore } from '../../core/auth/session.store';

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
  id: string | number;
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
  readonly sidebar = inject(SidebarService);
  private readonly swalService = inject(SwalService);

  private readonly identity = inject(IdentityService);
  private readonly session = inject(SessionStore);

  // ═══════════════════════════════════════════════════════════════
  // هویت عامل — همه از IdentityService (پیش از رندر صفحه راستی‌آزمایی و بارگذاری شده)
  // ═══════════════════════════════════════════════════════════════
  readonly isImpersonating = this.identity.isImpersonating;
  readonly impersonatedUserName = this.identity.impersonatedUserName;
  readonly impersonatedPositionName = this.identity.impersonatedPositionName;
  readonly switching = this.identity.switching;

  currentDate = signal<string>('');
  currentTime = signal<string>('');
  currentDay = signal<string>('');
  isRoleSwitcherOpen = signal<boolean>(false);

  readonly position = this.session.positionName;
  readonly selectedDelegation = this.session.positionGuid;
  readonly isDelegate = this.session.isDelegate;
  readonly delegations = computed(() => (this.isImpersonating() ? [] : this.identity.options()));
  readonly information = computed<UserInformation>(() => this.identity.profile() ?? {
    fullname: '', companyTitle: '', organizationChartTitle: '', classificationLevel: '',
    needChangePassword: false, companyGuid: '', organizationChartGuid: '', userName: '',
  });

  readonly selectedDelegationKey = computed(() => this.normalizeGuid(this.selectedDelegation()));

  readonly fileManagementUrl = computed(() => userPhotoUrl(this.information().userName, 48) || 'img/default-avatar.png');

  readonly avatarStyle = computed(() => `url(${this.fileManagementUrl()}), url(img/default-avatar.png)`);

  // در حالت ورود به جای کاربر، تغییر سمت غیرفعال است
  readonly hasMultipleDelegations = computed(() => !this.isImpersonating() && this.delegations().length > 1);

  // ═══════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════
  ngOnInit(): void {
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

  public normalizeGuid(value: string | null | undefined): string {
    return (value ?? '').trim().replace(/[{}]/g, '').toLowerCase();
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
    this.sidebar.toggleSidebar();
  }

  toggleRoleSwitcher(): void {
    if (this.isImpersonating()) return;
    this.isRoleSwitcherOpen.update(open => !open);
  }

  /** تغییر سمت/تفویض: دسترسی‌ها گرفته، داده‌های قبلی پاک و برنامه با هویت جدید بارگذاری می‌شود */
  switchAccount(item: Delegation): void {
    if (this.isImpersonating()) return;
    this.isRoleSwitcherOpen.set(false);
    if (this.normalizeGuid(item.positionGuid) === this.selectedDelegationKey()
        && this.normalizeGuid(item.userGuid) === this.normalizeGuid(this.session.userGuid())) return;
    void this.identity.switchTo(item);
  }

  // ═══════════════════════════════════════════════════════════════
  // Exit Impersonation
  // ═══════════════════════════════════════════════════════════════

  async exitImpersonation(): Promise<void> {
    const result = await this.swalService.fireSwal('آیا می‌خواهید به حساب اصلی خود بازگردید؟', '');
    if (result.value !== true) return;
    this.identity.exitImpersonation();
  }

  // ═══════════════════════════════════════════════════════════════
  // Logout
  // ═══════════════════════════════════════════════════════════════

  logout(): void {
    if (this.isImpersonating()) this.identity.exitImpersonation(false);
    this.performLogout();
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
