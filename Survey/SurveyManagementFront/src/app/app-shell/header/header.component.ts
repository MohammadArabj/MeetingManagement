import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { SessionStore } from '../../core/auth/session.store';
import { IdentityOption, IdentityService } from '../../core/auth/identity.service';
import { SwalService } from '../../services/framework-services/swal.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive]
})
export class HeaderComponent implements OnInit, OnDestroy {
  // هویت، سمت، تفویض و ورود به جای کاربر — همان IdentityService سامانه مدیریت جلسات
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly identity = inject(IdentityService);
  private readonly swalService = inject(SwalService);

  readonly isImpersonating = this.identity.isImpersonating;
  readonly impersonatedUserName = this.identity.impersonatedUserName;
  readonly impersonatedPositionName = this.identity.impersonatedPositionName;
  readonly switching = this.identity.switching;
  readonly delegations = this.identity.options;
  readonly position = this.session.positionName;
  readonly isDelegate = this.session.isDelegate;

  readonly information = computed(() => {
    const p = this.identity.profile();
    return {
      fullname: p?.fullname ?? '', companyTitle: p?.companyTitle ?? '', organizationChartTitle: p?.organizationChartTitle ?? '',
      classificationLevel: p?.classificationLevel ?? '', needChangePassword: !!p?.needChangePassword,
      companyGuid: p?.companyGuid ?? '', organizationChartGuid: p?.organizationChartGuid ?? '', userName: p?.userName ?? '',
    };
  });

  readonly switchError = signal('');
  readonly isDarkMode = signal<boolean>(false);
  readonly isRoleSwitcherOpen = signal<boolean>(false);
  readonly currentDate = signal<string>('');
  readonly currentTime = signal<string>('');
  readonly currentDay = signal<string>('');
  private timer?: ReturnType<typeof setInterval>;

  readonly fileManagementUrl = computed(() => {
    const userName = this.information().userName;
    if (!userName) return 'assets/img/default-avatar.png';
    const photoUrl = encodeURIComponent(`photo/${userName}.jpg`);
    return `${environment.fileManagementEndpoint}/api/Image?url=${photoUrl}&w=48&q=75`;
  });

  readonly selectedDelegationKey = computed(() => `${normalizeGuid(this.session.userGuid())}:${normalizeGuid(this.session.positionGuid())}`);
  readonly hasMultipleDelegations = computed(() => !this.isImpersonating() && this.delegations().length > 1);

  ngOnInit(): void {
    this.checkDarkMode();
    this.updateDateTime();
    this.timer = setInterval(() => this.updateDateTime(), 1000);
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target instanceof Element) || !event.target.closest('.role-sw')) this.isRoleSwitcherOpen.set(false);
  }

  private updateDateTime(): void {
    const now = new Date();
    this.currentDate.set(now.toLocaleDateString('fa-IR'));
    this.currentTime.set(now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
    this.currentDay.set(now.toLocaleDateString('fa-IR', { weekday: 'long' }));
  }

  toggleTheme(): void {
    this.isDarkMode.update(v => !v);
    document.body.classList.toggle('dark-mode', this.isDarkMode());
    localStorage.setItem('theme', this.isDarkMode() ? 'dark' : 'light');
  }

  private checkDarkMode(): void {
    if (localStorage.getItem('theme') === 'dark') {
      this.isDarkMode.set(true);
      document.body.classList.add('dark-mode');
    }
  }

  toggleRoleSwitcher(): void {
    if (this.isImpersonating()) return;
    this.isRoleSwitcherOpen.update(v => !v);
  }

  roleKey(item: IdentityOption): string {
    return `${normalizeGuid(item.userGuid)}:${normalizeGuid(item.positionGuid)}`;
  }

  /** تغییر سمت/تفویض: دریافت دسترسی‌ها ← ذخیره ← بارگذاری کامل برنامه (IdentityService.switchTo) */
  async switchAccount(item: IdentityOption): Promise<void> {
    if (this.roleKey(item) === this.selectedDelegationKey()) { this.isRoleSwitcherOpen.set(false); return; }
    this.switchError.set('');
    await this.identity.switchTo(item);
  }

  async exitImpersonation(): Promise<void> {
    const result = await this.swalService.fireSwal('آیا می‌خواهید به اکانت اصلی خود بازگردید؟', 'question');
    if (result.value !== true) return;
    this.identity.exitImpersonation();
  }

  logout(): void {
    if (this.isImpersonating()) this.identity.exitImpersonation(false);
    void this.auth.logout();
  }

  redirectToGrants(): void {
    window.location.href = `${environment.identityEndpoint}/grants/index`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('/assets/img/default-avatar.png')) img.src = 'assets/img/default-avatar.png';
  }
}

function normalizeGuid(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/[{}]/g, '').toLowerCase();
}
