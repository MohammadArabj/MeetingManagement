import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar';
import { LoadingBarComponent } from '../core/loading/loading-bar.component';

@Component({
  selector: 'app-app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css'],
  standalone: true,
  imports: [HeaderComponent, RouterOutlet, SidebarComponent, LoadingBarComponent]
})
export class AppShellComponent {
  readonly currentYear = new Date().getFullYear();
  readonly isOnline = signal<boolean>(navigator.onLine);
  /** باز بودن منو در موبایل */
  readonly sidebarOpen = signal(false);

  constructor() {
    const online = () => this.isOnline.set(true);
    const offline = () => this.isOnline.set(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    });
  }
}
