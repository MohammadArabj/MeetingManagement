import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PrintService } from '../../../core/print/print.service';
import { PrintBranding, PrintSettingsApiService, PrintSettingsModel } from '../../../services/print-settings.service';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';
import { ToastService } from '../../../services/framework-services/toast.service';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const PRINT_FONTS: { value: string; title: string }[] = [
  { value: '', title: 'پیش‌فرض (B Nazanin)' },
  { value: "'B Nazanin'", title: 'B Nazanin' },
  { value: "'B Lotus'", title: 'B Lotus' },
  { value: "'B Mitra'", title: 'B Mitra' },
  { value: "'B Yekan'", title: 'B Yekan' },
  { value: "'Sahel'", title: 'ساحل' },
  { value: "'Vazirmatn'", title: 'وزیرمتن' },
  { value: 'Tahoma', title: 'Tahoma' },
];

/** سربرگ ثابت همه‌ی چاپ‌ها: لوگو، نام شرکت، رنگ و فونت، پاورقی و واترمارک */
@Component({
  selector: 'app-print-branding-form',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="branding-form" (ngSubmit)="save()">
      <div class="row g-3">
        <div class="col-lg-8">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-semibold" for="pb-company">نام شرکت</label>
              <input id="pb-company" class="form-control" name="companyName" maxlength="120" [(ngModel)]="model().companyName">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold" for="pb-subtitle">زیرعنوان سربرگ</label>
              <input id="pb-subtitle" class="form-control" name="subtitle" maxlength="120" placeholder="مثلاً: دبیرخانه جلسات" [(ngModel)]="model().subtitle">
            </div>
            <div class="col-md-12">
              <label class="form-label fw-semibold" for="pb-address">نشانی</label>
              <input id="pb-address" class="form-control" name="address" maxlength="200" [(ngModel)]="model().address">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold" for="pb-phone">تلفن</label>
              <input id="pb-phone" class="form-control" dir="ltr" name="phone" maxlength="60" [(ngModel)]="model().phone">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold" for="pb-website">وب‌سایت</label>
              <input id="pb-website" class="form-control" dir="ltr" name="website" maxlength="100" [(ngModel)]="model().website">
            </div>
            <div class="col-md-12">
              <label class="form-label fw-semibold" for="pb-footer">متن پاورقی</label>
              <input id="pb-footer" class="form-control" name="footerText" maxlength="200" [(ngModel)]="model().footerText">
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold" for="pb-color">رنگ اصلی</label>
              <div class="d-flex gap-2">
                <input id="pb-color" type="color" class="form-control form-control-color" name="primaryColor"
                  [ngModel]="model().primaryColor || '#1f3a5f'" (ngModelChange)="model().primaryColor = $event">
                <button type="button" class="btn btn-sm btn-outline-secondary" (click)="model().primaryColor = null">پیش‌فرض</button>
              </div>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold" for="pb-font">فونت</label>
              <select id="pb-font" class="form-select" name="fontFamily" [(ngModel)]="model().fontFamily">
                @for (font of fonts; track font.value) {
                  <option [ngValue]="font.value || null">{{ font.title }}</option>
                }
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold" for="pb-watermark">واترمارک ثابت</label>
              <input id="pb-watermark" class="form-control" name="watermark" maxlength="40" placeholder="مثلاً: محرمانه" [(ngModel)]="model().watermark">
            </div>
            <div class="col-md-12 d-flex gap-4 flex-wrap">
              <div class="form-check form-switch">
                <input id="pb-date" class="form-check-input" type="checkbox" name="showPrintDate" [(ngModel)]="model().showPrintDate">
                <label class="form-check-label" for="pb-date">نمایش تاریخ چاپ</label>
              </div>
              <div class="form-check form-switch">
                <input id="pb-by" class="form-check-input" type="checkbox" name="showPrintedBy" [(ngModel)]="model().showPrintedBy">
                <label class="form-check-label" for="pb-by">نمایش چاپ‌کننده (سمت)</label>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <label class="form-label fw-semibold d-block">لوگو</label>
          <div class="logo-box">
            @if (logoUrl()) {
              <img [src]="logoUrl()" alt="لوگو">
            } @else {
              <span class="text-muted small">لوگوی پیش‌فرض سامانه</span>
            }
          </div>
          <div class="d-flex gap-2 mt-2">
            <label class="btn btn-sm btn-outline-primary mb-0" [class.disabled]="uploading()">
              @if (uploading()) { <span class="spinner-border spinner-border-sm ms-1"></span> }
              انتخاب تصویر
              <input type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" (change)="onLogoSelected($event)">
            </label>
            @if (model().logoGuid) {
              <button type="button" class="btn btn-sm btn-outline-danger" (click)="removeLogo()">حذف لوگو</button>
            }
          </div>
          <small class="text-muted d-block mt-1">PNG/JPG/WEBP، حداکثر ۲ مگابایت؛ ارتفاع در چاپ حدود ۵۶ پیکسل است.</small>
        </div>
      </div>

      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="submit" class="btn btn-primary" [disabled]="saving() || uploading()">
          @if (saving()) { <span class="spinner-border spinner-border-sm ms-1"></span> }
          ذخیره سربرگ
        </button>
      </div>
    </form>
  `,
  styles: [`
    .logo-box { border: 1px dashed var(--bs-border-color, #ccc); border-radius: .5rem; min-height: 120px;
      display: flex; align-items: center; justify-content: center; padding: .75rem; background: var(--bs-tertiary-bg, #fafafa); }
    .logo-box img { max-height: 100px; max-width: 100%; object-fit: contain; }
  `],
})
export class PrintBrandingFormComponent {
  private readonly api = inject(PrintSettingsApiService);
  private readonly print = inject(PrintService);
  private readonly tus = inject(TusUploadService);
  private readonly toast = inject(ToastService);

  readonly settings = input.required<PrintSettingsModel>();
  readonly saved = output<void>();

  readonly fonts = PRINT_FONTS;
  readonly model = signal<PrintBranding>({ showPrintDate: true, showPrintedBy: false });
  readonly logoUrl = signal<string>('');
  readonly uploading = signal(false);
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      const raw = this.settings().branding;
      // null برای انتخاب گزینه‌ی «پیش‌فرض» در فهرست‌ها
      const branding: PrintBranding = { ...raw, fontFamily: raw.fontFamily || null, primaryColor: raw.primaryColor || null };
      this.model.set(branding);
      void this.refreshLogo(branding.logoGuid ?? null);
    });
  }

  async onLogoSelected(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;

    if (!LOGO_TYPES.includes(file.type)) {
      this.toast.warning('فقط تصویر PNG، JPG، WEBP یا GIF قابل قبول است.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      this.toast.warning('حجم لوگو نباید بیشتر از ۲ مگابایت باشد.');
      return;
    }

    this.uploading.set(true);
    try {
      const guid = await this.tus.uploadDetached(file, 'Print/Branding', 'لوگوی سربرگ چاپ');
      this.model.update(m => ({ ...m, logoGuid: guid }));
      await this.refreshLogo(guid);
      this.toast.info('لوگو بارگذاری شد؛ برای اعمال، سربرگ را ذخیره کنید.');
    } catch (e: any) {
      this.toast.error(e?.message || 'خطا در بارگذاری لوگو');
    } finally {
      this.uploading.set(false);
    }
  }

  removeLogo(): void {
    this.model.update(m => ({ ...m, logoGuid: null }));
    this.logoUrl.set('');
  }

  async save(): Promise<void> {
    const model = this.model();
    if (model.primaryColor && !/^#[0-9a-f]{6}$/i.test(model.primaryColor)) {
      this.toast.warning('رنگ باید به شکل #RRGGBB باشد.');
      return;
    }

    this.saving.set(true);
    try {
      await firstValueFrom(this.api.saveBranding(model));
      this.print.invalidate();
      this.toast.success('سربرگ چاپ ذخیره شد.');
      this.saved.emit();
    } catch {
      // پیام خطا توسط HttpService نمایش داده می‌شود
    } finally {
      this.saving.set(false);
    }
  }

  private async refreshLogo(guid: string | null): Promise<void> {
    this.logoUrl.set(guid ? (await this.tus.getFilePreviewUrl(guid)) ?? '' : '');
  }
}
