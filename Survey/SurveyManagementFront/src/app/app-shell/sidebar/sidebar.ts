import { Component, input, output, signal, computed, inject, DestroyRef, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';

type NavItem = {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
  visible?: boolean;
  section?: string;
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly _permissions = signal<Set<string>>(new Set());
  readonly open = input<boolean>(false);
  readonly close = output<void>();

  readonly collapsed = signal<boolean>(false);
  readonly q = signal<string>('');

  // ✅ قبلاً فهرست یک‌بار (پیش از بارگذاری دسترسی‌ها) ساخته می‌شد و «visible» هم هرگز اعمال نمی‌شد.
  readonly items = computed<NavItem[]>(() => [
    { section: 'نظرسنجی', label: 'داشبورد', icon: 'fa fa-chart-line', route: '/dashboard' },
    { section: 'نظرسنجی', label: 'نظرسنجی‌های من', icon: 'fa fa-clipboard-check', route: '/surveys/my' },
    { section: 'مدیریت', label: 'نظرسنجی‌ها', icon: 'fa fa-list', route: '/surveys/list', exact: true },
    { section: 'مدیریت', label: 'ایجاد نظرسنجی', icon: 'fa fa-plus-circle', route: '/surveys/create', visible: this.hasPermission('SV_Surveys_Create') },
    { section: 'مدیریت', label: 'نقش‌ها و دسترسی‌ها', icon: 'fa fa-user-shield', route: '/user', visible: this.hasPermission('SV_AccessControl') },
  ].filter(x => x.visible !== false));

  readonly grouped = computed(() => {
    const q = this.q().trim().toLowerCase();
    const filtered = this.items().filter(x => !q || x.label.toLowerCase().includes(q));

    const map = new Map<string, NavItem[]>();
    for (const it of filtered) {
      const sec = it.section || 'سایر';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(it);
    }

    return Array.from(map.entries()).map(([section, items]) => ({ section, items }));
  });

  constructor() {
    // در موبایل بعد از ناوبری، سایدبار بسته شود
    this.router.events
      .pipe(
        filter(e => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.open()) this.close.emit();
      });
  }
  async ngOnInit(): Promise<void> {
    await this.loadPermissions();
  }

  toggleCollapse() {
    this.collapsed.update(v => !v);
  }

  closeSidebar() {
    this.close.emit();
  }

  private async loadPermissions(): Promise<void> {
    const granted = new Set<string>();
    for (const perm of ['SV_Surveys_Create', 'SV_AccessControl']) {
      if (await this.passwordFlowService.checkPermission(['SV_Admin', perm])) granted.add(perm);
    }
    this._permissions.set(granted);
  }

  private hasPermission(permission: string): boolean {
    return this._permissions().has(permission);
  }
}
