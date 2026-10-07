import { AfterViewInit, Component, DestroyRef, inject, Renderer2 } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwalService } from '../services/framework-services/swal.service';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb';
import { HeaderComponent } from './header/header';
import { SidebarComponent } from './sidebar/sidebar';
import { SidebarService } from '../services/framework-services/sidebar.service';
import { SystemSettingService } from '../services/system-setting.service';
import { RealtimeService } from '../core/realtime/realtime.service';
import { HelpPanelComponent } from './help-panel/help-panel.component';

@Component({
  selector: 'app-app-shell',
  imports: [SidebarComponent, HeaderComponent, BreadcrumbComponent, RouterOutlet, HelpPanelComponent],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  standalone: true
})
export class AppShellComponent implements AfterViewInit {
  readonly sidebar = inject(SidebarService);
  readonly systemSettingService = inject(SystemSettingService);
  private readonly realtime = inject(RealtimeService);

  constructor(private renderer: Renderer2) {
    // اعلان لحظه‌ای فقط داخل پوسته‌ی برنامه (پس از ورود)
    this.realtime.bindTo(inject(DestroyRef));
    void this.realtime.start();
  }
  ngAfterViewInit() {
    this.loadScripts([
      'js/main.js'
    ]);
  }

  private loadScripts(scripts: string[]): void {
    scripts.forEach(src => {
      const script = this.renderer.createElement('script');
      script.src = src;
      script.type = 'text/javascript';
      script.defer = true;
      this.renderer.appendChild(document.body, script);
    });
  }
}
