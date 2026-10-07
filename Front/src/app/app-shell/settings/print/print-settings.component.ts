import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { PrintService } from '../../../core/print/print.service';
import { PrintSettingsModel } from '../../../services/print-settings.service';
import { PrintBrandingFormComponent } from './print-branding-form.component';
import { PrintTemplateDesignerComponent } from './print-template-designer.component';

/**
 * «تنظیمات › چاپ و قالب‌ها»
 *   • سربرگ: لوگو، نام شرکت، رنگ، فونت، پاورقی و واترمارک — ثابت در همه‌ی چاپ‌ها
 *   • قالب‌ها: طراحی HTML/CSS هر سند با پیش‌نمایش زنده و بازگشت به پیش‌فرض
 */
@Component({
  selector: 'app-print-settings',
  imports: [PrintBrandingFormComponent, PrintTemplateDesignerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card settings-card">
      <div class="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h5 class="mb-0"><i class="fas fa-print me-2 text-primary"></i>چاپ و قالب‌ها</h5>
        <ul class="nav nav-pills nav-sm">
          <li class="nav-item">
            <button type="button" class="nav-link" [class.active]="tab() === 'branding'" (click)="tab.set('branding')">سربرگ و لوگو</button>
          </li>
          <li class="nav-item">
            <button type="button" class="nav-link" [class.active]="tab() === 'templates'" (click)="tab.set('templates')">طراحی قالب‌ها</button>
          </li>
        </ul>
      </div>

      <div class="card-body">
        @if (!settings()) {
          <div class="d-flex justify-content-center py-5"><div class="spinner-border text-primary"></div></div>
        } @else if (tab() === 'branding') {
          <app-print-branding-form [settings]="settings()!" (saved)="reload()" />
        } @else {
          <app-print-template-designer [settings]="settings()!" (changed)="reload()" />
        }
      </div>
    </section>
  `,
  styles: [`:host { display: block; } .settings-card { border-radius: .75rem; }`],
})
export class PrintSettingsComponent implements OnInit {
  private readonly print = inject(PrintService);

  readonly tab = signal<'branding' | 'templates'>('branding');
  readonly settings = signal<PrintSettingsModel | null>(null);

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.print.invalidate();
    this.settings.set(await this.print.getSettings(true));
  }
}
