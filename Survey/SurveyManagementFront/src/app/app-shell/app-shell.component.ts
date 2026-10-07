import { Component, OnInit, signal, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from "./sidebar/sidebar";


@Component({
  selector: 'app-app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css'],
  standalone: true,
  imports: [CommonModule, HeaderComponent, RouterOutlet, SidebarComponent]
})
export class AppShellComponent implements OnInit {

  // Signals
  readonly isLoading = signal<boolean>(false);
  readonly currentYear = new Date().getFullYear();
  readonly isOnline = signal<boolean>(navigator.onLine);

  ngOnInit(): void {
    this.setupOnlineListener();
    this.setupLoadingListener();
  }

  // Online/Offline Detection
  private setupOnlineListener(): void {
    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));
  }

  // Loading State (can be connected to a LoadingService)
  private setupLoadingListener(): void {
    // این می‌تونه با یک LoadingService سینک بشه
    // مثلاً از HTTP Interceptor
  }

  setLoading(state: boolean): void {
    this.isLoading.set(state);
  }
}