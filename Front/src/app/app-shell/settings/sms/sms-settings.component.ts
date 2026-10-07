import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NotificationCenterService } from '../../../services/notification-center.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { SettingsFormComponent } from '../general/settings-form.component';

/** پیامک و زمان‌بندی: تنظیمات کانال‌ها/ساعات سکوت/یادآوری‌ها + ارسال پیامک آزمایشی */
@Component({
  selector: 'app-sms-settings',
  imports: [FormsModule, SettingsFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-column gap-3">
      <app-settings-form [categories]="[4]" heading="پیامک، اعلان و زمان‌بندی یادآوری‌ها" />

      <section class="card">
        <div class="card-header"><h6 class="mb-0"><i class="fas fa-paper-plane ms-2"></i>ارسال پیامک آزمایشی</h6></div>
        <div class="card-body">
          <div class="row g-2 align-items-end">
            <div class="col-md-4">
              <label class="form-label" for="test-mobile">شماره موبایل</label>
              <input id="test-mobile" class="form-control" dir="ltr" placeholder="09xxxxxxxxx"
                [ngModel]="mobile()" (ngModelChange)="mobile.set($event)">
            </div>
            <div class="col-md-6">
              <label class="form-label" for="test-text">متن (اختیاری)</label>
              <input id="test-text" class="form-control" [ngModel]="text()" (ngModelChange)="text.set($event)">
            </div>
            <div class="col-md-2 d-grid">
              <button type="button" class="btn btn-success" [disabled]="sending() || !mobile()" (click)="send()">
                @if (sending()) { <span class="spinner-border spinner-border-sm ms-1"></span> } ارسال
              </button>
            </div>
          </div>
          @if (result(); as r) {
            <div class="alert mt-3 mb-0" [class.alert-success]="r.ok" [class.alert-danger]="!r.ok">{{ r.message }}</div>
          }
          <small class="text-muted d-block mt-2">
            ارسال آزمایشی مستقیم انجام می‌شود (بدون صف). در «حالت آزمایشی» پیامک واقعی ارسال نمی‌شود و فقط در لاگ سرور ثبت می‌شود.
          </small>
        </div>
      </section>

      <section class="card">
        <div class="card-body small text-muted">
          <h6 class="text-body">نحوه کار ارسال</h6>
          <ul class="mb-0">
            <li>پیام‌ها هم‌زمان با عملیات کاربر در صف ثبت و هر دقیقه توسط سرویس پس‌زمینه ارسال می‌شوند.</li>
            <li>در صورت خطا، با فاصله ۲، ۴، ۸ ... دقیقه تا سقف «حداکثر تلاش مجدد» دوباره ارسال می‌شود.</li>
            <li>در ساعات سکوت پیامی ارسال نمی‌شود و ارسال به پایان بازه موکول می‌شود. اعلان داخل سامانه محدودیت ساعت ندارد.</li>
            <li>یادآوری جلسه و سررسید تخصیص هر ۱۰ دقیقه بررسی می‌شوند و هر یادآوری فقط یک بار ارسال می‌شود.</li>
          </ul>
        </div>
      </section>
    </div>
  `,
})
export class SmsSettingsComponent {
  private readonly api = inject(NotificationCenterService);
  private readonly toast = inject(ToastService);

  readonly mobile = signal('');
  readonly text = signal('');
  readonly sending = signal(false);
  readonly result = signal<{ ok: boolean; message: string } | null>(null);

  async send(): Promise<void> {
    this.sending.set(true);
    this.result.set(null);
    try {
      await firstValueFrom(this.api.testSms(this.mobile(), this.text()));
      this.result.set({ ok: true, message: 'پیامک با موفقیت ارسال شد.' });
    } catch (e: any) {
      this.result.set({ ok: false, message: e?.message ?? 'ارسال ناموفق بود.' });
    } finally {
      this.sending.set(false);
    }
  }
}
