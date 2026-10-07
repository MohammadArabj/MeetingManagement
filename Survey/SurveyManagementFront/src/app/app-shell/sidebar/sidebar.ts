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

  readonly items = signal<NavItem[]>([
    {
      section: 'مدیریت',
      label: 'نظرسنجی‌ها',
      icon: 'fa fa-list',
      route: '/surveys/list',
      visible: this.hasPermission('SV_Surveys'),
      exact: true
    },
    { section: 'مدیریت', label: 'ایجاد نظرسنجی', icon: 'fa fa-plus-circle', route: '/surveys/create', visible: this.hasPermission('MT_Surveys_Create') },

    // { section: 'عملیات', label: 'سوالات', icon: 'fa fa-question-circle', route: '/questions/list' },
    // { section: 'عملیات', label: 'پاسخ‌ها', icon: 'fa fa-inbox', route: '/responses/list' },

    { section: 'گزارش', label: 'داشبورد', icon: 'fa fa-chart-line', route: '/dashboard' },
    //{ section: 'گزارش', label: 'گزارش‌گیری', icon: 'fa fa-file-alt', route: '/reports' }
  ]);

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
    const permissionsToCheck = [
      'SV_Surveys',
      'SV_Surveys_Create',
    ];

    const newPermissions = new Set<string>();

    // Use Promise.allSettled for better error handling
    const results = await Promise.allSettled(
      permissionsToCheck.map(async (perm) => {
        const hasPermission = await this.passwordFlowService.checkPermission(perm);
        return { perm, hasPermission };
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { perm, hasPermission } = result.value;
        if (hasPermission) {
          newPermissions.add(perm);
        }
      } else {
        console.error(`Error checking permission:`, result.reason);
      }
    });

    this._permissions.set(newPermissions);
  }

  private hasPermission(permission: string): boolean {
    return this._permissions().has(permission);
  }
}
