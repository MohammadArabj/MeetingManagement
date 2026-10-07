import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({ providedIn: 'root' })
export class SidebarService {

    toggleSidebar(): void {
        const html = document.documentElement;
        html.classList.toggle('layout-menu-collapsed');
        html.classList.toggle('layout-menu-expanded');
      }

      isSidebarCollapsed(): boolean {
        return document.documentElement.classList.contains('layout-menu-collapsed');
      }

      expandSidebar(): void {
        const html = document.documentElement;
        html.classList.remove('layout-menu-collapsed');
        html.classList.add('layout-menu-expanded');
      }

      collapseSidebar(): void {
        const html = document.documentElement;
        html.classList.remove('layout-menu-expanded');
        html.classList.add('layout-menu-collapsed');
      }
}
