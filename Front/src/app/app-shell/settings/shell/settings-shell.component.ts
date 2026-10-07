import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionStore } from '../../../core/auth/session.store';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { SETTINGS_NAV as NAV } from '../settings-nav';

@Component({
  selector: 'app-settings-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings-page">
      <header class="settings-header">
        <div>
          <h4 class="mb-1"><i class="fas fa-gear me-2 text-primary"></i>تنظیمات سامانه</h4>
          <small class="text-muted">پیکربندی جلسات، هیئت مدیره، اطلاع‌رسانی و دسترسی نقش‌ها</small>
        </div>
      </header>

      <div class="settings-body">
        <nav class="settings-nav" aria-label="بخش‌های تنظیمات">
          @for (group of groups(); track group.name) {
            <div class="nav-group-title">{{ group.name }}</div>
            @for (item of group.items; track item.path) {
              <a class="nav-item" [routerLink]="item.path" routerLinkActive="active">
                <i class="fas {{ item.icon }}"></i>
                <span class="nav-text">
                  <span class="nav-title">{{ item.title }}</span>
                  <span class="nav-hint">{{ item.hint }}</span>
                </span>
              </a>
            }
          }
        </nav>

        <main class="settings-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .settings-page { padding: 1rem; }
    .settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .settings-body { display: grid; grid-template-columns: 260px 1fr; gap: 1rem; align-items: start; }
    .settings-nav { background: var(--bs-body-bg, #fff); border: 1px solid var(--bs-border-color, #e5e7eb);
      border-radius: .75rem; padding: .5rem; position: sticky; top: 1rem; }
    .nav-group-title { font-size: .75rem; color: var(--bs-secondary-color, #6b7280); padding: .75rem .75rem .25rem; font-weight: 600; }
    .nav-item { display: flex; gap: .75rem; align-items: center; padding: .55rem .75rem; border-radius: .5rem;
      color: inherit; text-decoration: none; transition: background .15s; }
    .nav-item i { width: 1.25rem; text-align: center; color: var(--bs-secondary-color, #6b7280); }
    .nav-item:hover { background: var(--bs-tertiary-bg, #f3f4f6); }
    .nav-item.active { background: color-mix(in srgb, var(--bs-primary, #0d6efd) 10%, transparent); }
    .nav-item.active i, .nav-item.active .nav-title { color: var(--bs-primary, #0d6efd); }
    .nav-text { display: flex; flex-direction: column; line-height: 1.3; }
    .nav-title { font-weight: 600; font-size: .9rem; }
    .nav-hint { font-size: .72rem; color: var(--bs-secondary-color, #6b7280); }
    .settings-content { min-width: 0; }
    @media (max-width: 992px) {
      .settings-body { grid-template-columns: 1fr; }
      .settings-nav { position: static; display: flex; flex-wrap: wrap; gap: .25rem; }
      .nav-group-title, .nav-hint { display: none; }
    }
  `],
})
export class SettingsShellComponent {
  private readonly session = inject(SessionStore);

  constructor() {
    inject(BreadcrumbService).setItems([{ label: 'تنظیمات سامانه', routerLink: '/settings' }]);
  }

  readonly groups = computed(() => {
    this.session.permissions(); // وابستگی واکنشی به تغییر سمت
    const visible = NAV.filter(i => this.session.hasAnyPermission(i.perms));
    const names = Array.from(new Set(visible.map(i => i.group)));
    return names.map(name => ({ name, items: visible.filter(i => i.group === name) }));
  });
}
