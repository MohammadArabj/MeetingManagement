import { Component, computed, inject, signal, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';


import { SidebarService } from '../../services/framework-services/sidebar.service';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { WhatsNewComponent } from '../whats-new/whats-new.component';

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
  private readonly sidebarService = inject(SidebarService);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Version Configuration
  // ═══════════════════════════════════════════════════════════════════════════════
  readonly appVersion = '1.5.0';
  private readonly SEEN_VERSION_KEY = 'whats-new-seen-version';

  // ═══════════════════════════════════════════════════════════════════════════════
  // Sidebar State
  // ═══════════════════════════════════════════════════════════════════════════════
  readonly isMenuCollapsed = computed(() => this.sidebarService.collapsed());

  // ═══════════════════════════════════════════════════════════════════════════════
  // What's New Reference
  // ═══════════════════════════════════════════════════════════════════════════════
  @ViewChild(WhatsNewComponent) whatsNewComponent!: WhatsNewComponent;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Methods
  // ═══════════════════════════════════════════════════════════════════════════════

  toggleSidebar(): void {
    this.sidebarService.toggleSidebar();
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
