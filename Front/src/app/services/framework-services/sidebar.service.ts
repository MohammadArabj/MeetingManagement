// sidebar.service.ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { LocalStorageService } from './local.storage.service';

/** حالت چیدمان بر اساس عرض صفحه */
export type SidebarMode = 'desktop' | 'compact' | 'mobile';

const COMPACT_QUERY = '(max-width: 1199.98px)';
const MOBILE_QUERY = '(max-width: 991.98px)';

/**
 * وضعیت منوی کناری در همه‌ی اندازه‌های صفحه.
 * ─────────────────────────────────────────────────────────────────────────
 *  • desktop (≥1200px): منوی کامل؛ جمع/باز شدن آن ذخیره می‌شود.
 *  • compact (992–1199px، مانیتورهای کوچک): نوار باریک آیکونی همیشه دیده می‌شود؛ دکمه‌ی منو آن را
 *    روی محتوا باز می‌کند (بدون جابه‌جا کردن صفحه).
 *  • mobile (<992px): منو کشویی است؛ با دکمه‌ی منو در سرصفحه باز می‌شود و با انتخاب صفحه، کلیک بیرون
 *    یا Esc بسته می‌شود.
 * (قبلاً زیر ۱۲۰۰ پیکسل منو کاملاً بیرون از صفحه بود و دکمه‌ی باز کردنش هم داخل خود منو بود.)
 */
@Injectable({ providedIn: 'root' })
export class SidebarService {
  private readonly STORAGE_KEY = 'templateCustomizer-vertical-menu-template--LayoutCollapsed';
  private readonly localStorage = inject(LocalStorageService);

  /** ترجیح کاربر در حالت دسکتاپ */
  readonly collapsed = signal<boolean>(false);
  readonly mode = signal<SidebarMode>('desktop');
  /** منوی باز روی محتوا (compact) یا کشوی باز (mobile) */
  readonly overlayOpen = signal(false);

  /** منو به‌صورت نوار باریک آیکونی نمایش داده شود؟ */
  readonly isRail = computed(() =>
    this.mode() === 'desktop' ? this.collapsed() : this.mode() === 'compact' && !this.overlayOpen());
  readonly showBackdrop = computed(() => this.mode() !== 'desktop' && this.overlayOpen());

  constructor() {
    this.collapsed.set(this.localStorage.getItem(this.STORAGE_KEY) === 'true');

    if (typeof window !== 'undefined' && window.matchMedia) {
      const compact = window.matchMedia(COMPACT_QUERY);
      const mobile = window.matchMedia(MOBILE_QUERY);
      const update = () => {
        this.mode.set(mobile.matches ? 'mobile' : compact.matches ? 'compact' : 'desktop');
        this.overlayOpen.set(false);
      };
      update();
      compact.addEventListener('change', update);
      mobile.addEventListener('change', update);

      window.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.overlayOpen()) this.overlayOpen.set(false);
      });
    }

    // با رفتن به صفحه‌ی دیگر، منوی روی محتوا بسته شود
    inject(Router).events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.overlayOpen.set(false));
  }

  toggleSidebar(): void {
    if (this.mode() === 'desktop') this.setCollapsed(!this.collapsed());
    else this.overlayOpen.update(open => !open);
  }

  closeOverlay(): void {
    this.overlayOpen.set(false);
  }

  setCollapsed(value: boolean): void {
    this.collapsed.set(value);
    this.localStorage.setItem(this.STORAGE_KEY, value.toString());
  }
}
