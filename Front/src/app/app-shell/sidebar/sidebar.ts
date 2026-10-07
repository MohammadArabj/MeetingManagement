import { Component, computed, HostListener, inject, signal, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';


import { SidebarService } from '../../services/framework-services/sidebar.service';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { WhatsNewComponent } from '../whats-new/whats-new.component';
import { HelpService } from '../../core/help/help.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    FormsModule,
    HasPermissionDirective,
    WhatsNewComponent
],
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent {
  readonly sidebar = inject(SidebarService);
  readonly help = inject(HelpService);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Version Configuration
  // ═══════════════════════════════════════════════════════════════════════════════
  readonly appVersion = '1.5.0';
  private readonly SEEN_VERSION_KEY = 'whats-new-seen-version';

  // ═══════════════════════════════════════════════════════════════════════════════
  // Sidebar State
  // ═══════════════════════════════════════════════════════════════════════════════
  /** نوار باریک آیکونی (دسکتاپ جمع‌شده یا مانیتور کوچک) */
  readonly isMenuCollapsed = computed(() => this.sidebar.isRail());
  readonly toggleTitle = computed(() =>
    this.sidebar.mode() === 'mobile' ? 'بستن منو' : this.isMenuCollapsed() ? 'باز کردن منو' : 'جمع کردن منو');

  // ═══════════════════════════════════════════════════════════════════════════════
  // What's New Reference
  // ═══════════════════════════════════════════════════════════════════════════════
  @ViewChild(WhatsNewComponent) whatsNewComponent!: WhatsNewComponent;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  /** در حالت نوار آیکونی، کلیک روی گروهی که زیرمنو دارد منو را باز می‌کند تا زیرمنو دیده شود */
  @HostListener('click', ['$event'])
  onMenuClick(event: MouseEvent): void {
    if (!this.isMenuCollapsed()) return;
    const toggle = (event.target as HTMLElement | null)?.closest('.menu-toggle');
    if (!toggle) return;
    if (this.sidebar.mode() === 'desktop') this.sidebar.setCollapsed(false);
    else this.sidebar.overlayOpen.set(true);
  }

  toggleSidebar(): void {
    this.sidebar.toggleSidebar();
  }

  /**
   * بررسی اینکه آیا کاربر نسخه جدید را دیده یا نه
   */
  hasNewUpdates(): boolean {
    const seenVersion = localStorage.getItem(this.SEEN_VERSION_KEY);
    return seenVersion !== this.appVersion;
  }

  /**
   * باز کردن مودال What's New
   */
  openWhatsNew(): void {
    if (this.whatsNewComponent) {
      this.whatsNewComponent.show();
    }
  }
}
