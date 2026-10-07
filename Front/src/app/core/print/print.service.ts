import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import moment from 'jalali-moment';

import { environment } from '../../../environments/environment';
import { POSITION_NAME } from '../types/configuration';
import { TusUploadService } from '../../services/framework-services/tus-upload.service';
import { PrintBranding, PrintSettingsApiService, PrintSettingsModel } from '../../services/print-settings.service';
import { escapeHtml, renderTemplate, validateTemplate } from './template-engine';
import { sanitizeCss, sanitizeRichHtml } from './html-sanitizer';
import { PrintTemplateContent, PrintTemplateDefinition, getPrintTemplate } from './print-templates';

export interface PrintOptions {
  /** عنوان سند (عنوان پنجره و سربرگ) */
  title: string;
  /** واترمارک این چاپ (مثلاً «پیش‌نویس»)؛ پیش‌فرض: واترمارک تنظیمات */
  watermark?: string;
  /** نمایش سربرگ مشترک؛ پیش‌فرض true (سندهای دارای سربرگ اختصاصی همیشه بدون سربرگ مشترک) */
  header?: boolean;
  footer?: boolean;
  /** پنجره‌ای که پیش از هر await (در همان کلیک کاربر) باز شده تا مسدودکننده‌ی پاپ‌آپ جلوی آن را نگیرد */
  target?: Window | null;
}

export interface TemplateSource {
  html: string;
  css: string;
}

export interface ResolvedTemplate extends TemplateSource {
  custom: boolean;
}

export interface ComposeInput {
  definition: PrintTemplateDefinition;
  template: TemplateSource;
  layout: TemplateSource;
  data: Record<string, unknown>;
  branding: PrintBranding;
  logoUrl: string;
  options: PrintOptions;
}

const SETTINGS_TTL_MS = 5 * 60 * 1000;
const DEFAULT_BRANDING: PrintBranding = { companyName: '', showPrintDate: true, showPrintedBy: false };
const COLOR = /^#[0-9a-f]{6}$/i;

/**
 * چاپ همه‌ی اسناد سامانه با قالب‌های قابل طراحی.
 * ─────────────────────────────────────────────────────────────────────────
 * سند = قالب سند (پیش‌فرض یا سفارشی) ← درون قاب مشترک (سربرگ با لوگو/نام شرکت، پاورقی، واترمارک).
 * هیچ اسکریپتی در پنجره‌ی چاپ نوشته نمی‌شود: محتوا پاک‌سازی می‌شود و فرمان چاپ از همین پنجره‌ی اصلی صادر می‌شود.
 */
@Injectable({ providedIn: 'root' })
export class PrintService {
  private readonly api = inject(PrintSettingsApiService);
  private readonly tus = inject(TusUploadService);

  private settingsPromise: Promise<PrintSettingsModel> | null = null;
  private settingsLoadedAt = 0;
  private readonly contentCache = new Map<string, PrintTemplateContent | null>();

  /** پس از تغییر تنظیمات چاپ */
  invalidate(): void {
    this.settingsPromise = null;
    this.settingsLoadedAt = 0;
  }

  getSettings(force = false): Promise<PrintSettingsModel> {
    const fresh = Date.now() - this.settingsLoadedAt < SETTINGS_TTL_MS;
    if (!force && this.settingsPromise && fresh) return this.settingsPromise;

    this.settingsLoadedAt = Date.now();
    this.settingsPromise = firstValueFrom(this.api.getSettings())
      .then(s => ({
        branding: { ...DEFAULT_BRANDING, ...(s?.branding ?? {}) },
        templates: s?.templates ?? {},
      }))
      .catch(() => {
        // چاپ نباید به‌خاطر خطای تنظیمات متوقف شود؛ با پیش‌فرض‌ها ادامه می‌دهیم و بار بعد دوباره تلاش می‌کنیم
        this.settingsLoadedAt = 0;
        return { branding: { ...DEFAULT_BRANDING }, templates: {} };
      });
    return this.settingsPromise;
  }

  /** قالب مؤثر یک کلید (سفارشی در صورت وجود و سالم بودن، وگرنه پیش‌فرض) */
  async getTemplate(key: string, settings?: PrintSettingsModel): Promise<ResolvedTemplate> {
    const definition = this.definition(key);
    const s = settings ?? await this.getSettings();
    const guid = this.templateGuid(s, key);
    if (guid) {
      const content = await this.loadTemplateContent(guid);
      if (content && validateTemplate(content.html) === null) {
        return { html: content.html, css: content.css, custom: true };
      }
    }
    return { html: definition.defaultHtml, css: definition.defaultCss, custom: false };
  }

  templateGuid(settings: PrintSettingsModel, key: string): string | null {
    const entry = Object.entries(settings.templates ?? {}).find(([k]) => k.toLowerCase() === key.toLowerCase());
    return entry?.[1] || null;
  }

  /** خواندن فایل JSON قالب از سامانه مدیریت فایل */
  async loadTemplateContent(guid: string): Promise<PrintTemplateContent | null> {
    const normalized = guid.toLowerCase();
    if (this.contentCache.has(normalized)) return this.contentCache.get(normalized) ?? null;

    let content: PrintTemplateContent | null = null;
    try {
      const blob = await this.tus.downloadBlob(normalized);
      if (blob) {
        const parsed = JSON.parse(await blob.text());
        if (parsed && parsed.version === 1 && typeof parsed.html === 'string') {
          content = {
            version: 1,
            html: parsed.html,
            css: typeof parsed.css === 'string' ? parsed.css : '',
            updatedAt: parsed.updatedAt,
            updatedBy: parsed.updatedBy,
          };
        }
      }
    } catch {
      content = null;
    }
    // فایل‌ها تغییرناپذیرند (هر ذخیره یک فایل جدید)؛ پس کش بدون انقضا امن است. خطاها کش نمی‌شوند.
    if (content) this.contentCache.set(normalized, content);
    return content;
  }

  rememberTemplateContent(guid: string, content: PrintTemplateContent): void {
    this.contentCache.set(guid.toLowerCase(), content);
  }

  async resolveLogoUrl(branding: PrintBranding): Promise<string> {
    if (branding.logoGuid) {
      const url = await this.tus.getFilePreviewUrl(branding.logoGuid);
      if (url) return url;
    }
    return `${environment.selfEndpoint}/img/MainLogo.png`;
  }

  /** باز کردن پنجره‌ی چاپ؛ باید همزمان با کلیک کاربر (پیش از هر await) صدا زده شود */
  openWindow(): Window | null {
    const win = window.open('', '_blank', 'width=1000,height=760');
    if (win) {
      win.document.open();
      win.document.write('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>در حال آماده‌سازی…</title></head>'
        + '<body style="font-family:Tahoma,sans-serif;display:flex;align-items:center;justify-content:center;height:90vh;color:#555">در حال آماده‌سازی چاپ…</body></html>');
      win.document.close();
    }
    return win;
  }

  /** ساخت و چاپ یک سند با قالب key */
  async print(key: string, data: Record<string, unknown>, options: PrintOptions): Promise<void> {
    const win = options.target ?? this.openWindow();
    if (!win) throw new Error('پنجره‌ی چاپ باز نشد؛ لطفاً اجازه‌ی باز شدن پنجره‌ی جدید (Pop-up) را بدهید.');

    try {
      const html = await this.buildDocument(key, data, options);
      await this.writeAndPrint(win, html);
    } catch (e) {
      if (!win.closed) win.close();
      throw e;
    }
  }

  /** گزارش‌هایی که بدنه‌شان را برنامه می‌سازد (فقط قاب و CSS قابل طراحی است) */
  printReport(key: string, contentHtml: string, options: PrintOptions): Promise<void> {
    return this.print(key, { content: contentHtml }, options);
  }

  async buildDocument(key: string, data: Record<string, unknown>, options: PrintOptions): Promise<string> {
    const settings = await this.getSettings();
    const [template, layout, logoUrl] = await Promise.all([
      this.getTemplate(key, settings),
      this.getTemplate('layout', settings),
      this.resolveLogoUrl(settings.branding),
    ]);
    return this.compose({
      definition: this.definition(key),
      template,
      layout,
      data,
      branding: settings.branding,
      logoUrl,
      options,
    });
  }

  /** ترکیب قالب سند و قاب مشترک (همزمان؛ پیش‌نمایش طراح هم از همین استفاده می‌کند) */
  compose(input: ComposeInput): string {
    const { definition, template, layout, data, branding, logoUrl, options } = input;

    const context: Record<string, unknown> = {
      ...data,
      company: {
        name: branding.companyName ?? '',
        subtitle: branding.subtitle ?? '',
        logoUrl,
        address: branding.address ?? '',
        phone: branding.phone ?? '',
        website: branding.website ?? '',
        footerText: branding.footerText ?? '',
      },
      document: { title: options.title },
      printDate: branding.showPrintDate ? moment().locale('fa').format('YYYY/MM/DD HH:mm') : '',
      printedBy: branding.showPrintedBy ? (localStorage.getItem(POSITION_NAME) ?? '') : '',
    };

    const body = sanitizeRichHtml(renderTemplate(template.html, context, { sanitizeHtml: sanitizeRichHtml }));

    const token = `pt-content-${Math.random().toString(36).slice(2)}`;
    const frame = sanitizeRichHtml(renderTemplate(layout.html, {
      ...context,
      header: definition.layoutHeader && options.header !== false,
      footer: options.footer !== false,
      watermark: options.watermark ?? branding.watermark ?? '',
      content: token,
    }, { sanitizeHtml: v => v }));
    const page = frame.includes(token) ? frame.replace(token, () => body) : frame + body;

    const css = sanitizeCss([this.rootVariables(branding), FONT_FACES, layout.css, template.css].join('\n'));

    return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">`
      + `<meta name="viewport" content="width=device-width, initial-scale=1">`
      + `<title>${escapeHtml(options.title)}</title><style>${css}</style></head>`
      + `<body>${page}</body></html>`;
  }

  /** نوشتن سند در پنجره، صبر برای بارگذاری تصاویر/فونت‌ها و سپس چاپ */
  async writeAndPrint(win: Window, html: string): Promise<void> {
    win.document.open();
    win.document.write(html);
    win.document.close();

    await this.whenReady(win);
    if (win.closed) return;
    win.onafterprint = () => win.close();
    win.focus();
    win.print();
  }

  definition(key: string): PrintTemplateDefinition {
    const definition = getPrintTemplate(key);
    if (!definition) throw new Error(`قالب چاپ «${key}» تعریف نشده است.`);
    return definition;
  }

  private rootVariables(branding: PrintBranding): string {
    const vars: string[] = [];
    if (branding.primaryColor && COLOR.test(branding.primaryColor)) vars.push(`--pt-primary:${branding.primaryColor}`);
    const font = (branding.fontFamily ?? '').replace(/[^\p{L}\p{N}\s,'"-]/gu, '').trim();
    if (font) vars.push(`--pt-font:${font}, 'B Nazanin', Tahoma, sans-serif`);
    return vars.length ? `:root{${vars.join(';')}}` : '';
  }

  private whenReady(win: Window): Promise<void> {
    const images = Array.from(win.document.images).filter(img => !img.complete);
    const imagesLoaded = Promise.all(images.map(img => new Promise<void>(resolve => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    })));
    const fonts = (win.document as any).fonts?.ready ?? Promise.resolve();
    const timeout = new Promise<void>(resolve => setTimeout(resolve, 4000));
    return Promise.race([Promise.all([imagesLoaded, fonts]).then(() => undefined), timeout]);
  }
}

/** فونت‌های فارسی موجود در خود برنامه (در صورت نصب نبودن روی سیستم کاربر) */
const FONT_FACES = `@font-face { font-family: 'Sahel'; src: url('${environment.selfEndpoint}/fonts/Sahel.ttf'); }
@font-face { font-family: 'Vazirmatn'; src: url('${environment.selfEndpoint}/fonts/Vazirmatn-Medium.ttf'); }`;
