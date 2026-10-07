import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

import { PrintService, TemplateSource } from '../../../core/print/print.service';
import {
  PRINT_TEMPLATES, PrintTemplateContent, PrintTemplateDefinition, PrintVariable, getPrintTemplate,
} from '../../../core/print/print-templates';
import { validateTemplate } from '../../../core/print/template-engine';
import { PrintSettingsApiService, PrintSettingsModel } from '../../../services/print-settings.service';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';
import { ToastService } from '../../../services/framework-services/toast.service';

type EditorTab = 'html' | 'css' | 'variables' | 'help';

const KIND_TITLES: Record<PrintTemplateDefinition['kind'], string> = {
  layout: 'قاب مشترک',
  document: 'اسناد',
  report: 'گزارش‌ها',
};

/**
 * طراح قالب‌های چاپ: ویرایش HTML/CSS، فهرست متغیرها، پیش‌نمایش زنده با داده‌ی نمونه و ذخیره/بازگشت به پیش‌فرض.
 * پیش‌نمایش در iframe با sandbox خالی نمایش داده می‌شود (بدون اسکریپت و بدون دسترسی به برنامه).
 */
@Component({
  selector: 'app-print-template-designer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="designer">
      <aside class="tpl-list">
        @for (group of groups; track group.kind) {
          <div class="tpl-group">{{ group.title }}</div>
          @for (t of group.items; track t.key) {
            <button type="button" class="tpl-item" [class.active]="t.key === selectedKey()" (click)="select(t.key)">
              <span class="tpl-title">{{ t.title }}</span>
              @if (isCustom(t.key)) { <span class="badge bg-info-subtle text-info-emphasis">سفارشی</span> }
            </button>
          }
        }
      </aside>

      <div class="tpl-editor">
        @if (definition(); as def) {
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
            <div>
              <h6 class="mb-1">{{ def.title }}
                @if (isCustom(def.key)) { <span class="badge bg-info-subtle text-info-emphasis me-1">سفارشی</span> }
                @else { <span class="badge bg-secondary-subtle text-secondary-emphasis me-1">پیش‌فرض</span> }
              </h6>
              <small class="text-muted">{{ def.description }}</small>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <button type="button" class="btn btn-sm btn-outline-secondary" (click)="loadDefault()" title="محتوای پیش‌فرض در ویرایشگر قرار می‌گیرد (تا ذخیره نکنید اعمال نمی‌شود)">
                بارگذاری پیش‌فرض
              </button>
              @if (isCustom(def.key)) {
                <button type="button" class="btn btn-sm btn-outline-danger" [disabled]="busy()" (click)="resetToDefault()">بازگشت به پیش‌فرض</button>
              }
              <button type="button" class="btn btn-sm btn-outline-primary" [disabled]="!!error()" (click)="testPrint()">چاپ آزمایشی</button>
              <button type="button" class="btn btn-sm btn-primary" [disabled]="busy() || !dirty() || !!error()" (click)="save()">
                @if (busy()) { <span class="spinner-border spinner-border-sm ms-1"></span> }
                ذخیره قالب
              </button>
            </div>
          </div>

          @if (def.kind === 'report') {
            <div class="alert alert-light border py-2 small mb-2">
              بدنه‌ی این گزارش را برنامه می‌سازد و با <code dir="ltr">{{ syntax.content }}</code> درج می‌شود؛ ظاهر آن با CSS قابل تغییر است.
            </div>
          }

          <ul class="nav nav-tabs nav-sm">
            <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'html'" (click)="tab.set('html')">HTML</button></li>
            <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'css'" (click)="tab.set('css')">CSS</button></li>
            <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'variables'" (click)="tab.set('variables')">متغیرها</button></li>
            <li class="nav-item"><button type="button" class="nav-link" [class.active]="tab() === 'help'" (click)="tab.set('help')">راهنما</button></li>
          </ul>

          <div class="editor-pane">
            @switch (tab()) {
              @case ('html') {
                <textarea #htmlArea class="form-control code" dir="ltr" spellcheck="false" [value]="html()"
                  (input)="html.set($any($event.target).value)"></textarea>
              }
              @case ('css') {
                <textarea class="form-control code" dir="ltr" spellcheck="false" [value]="css()"
                  (input)="css.set($any($event.target).value)"></textarea>
              }
              @case ('variables') {
                <div class="vars">
                  <small class="text-muted d-block mb-2">با کلیک روی هر متغیر، در محل نشانگر ویرایشگر HTML درج می‌شود.</small>
                  <table class="table table-sm align-middle mb-0">
                    <tbody>
                      @for (v of def.variables; track v.name) {
                        <tr>
                          <td><button type="button" class="btn btn-link btn-sm p-0 font-monospace" dir="ltr" (click)="insertVariable(v)">{{ v.name }}</button></td>
                          <td class="small">{{ v.description }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              @case ('help') {
                <div class="help small">
                  <ul class="mb-0">
                    <li><code dir="ltr">{{ syntax.text }}</code> مقدار متنی (ایمن؛ HTML آن نمایش داده نمی‌شود)</li>
                    <li><code dir="ltr">{{ syntax.html }}</code> متن HTML ویرایشگر (پس از پاک‌سازی امنیتی)</li>
                    <li><code dir="ltr">{{ syntax.each }}</code> تکرار؛ داخل حلقه <code dir="ltr">{{ syntax.number }}</code> شماره ردیف و <code dir="ltr">{{ syntax.self }}</code> خود عنصر است</li>
                    <li><code dir="ltr">{{ syntax.ifBlock }}</code> و <code dir="ltr">{{ syntax.unless }}</code> شرط</li>
                    <li><code dir="ltr">{{ syntax.comment }}</code> در خروجی نمی‌آید</li>
                    <li>کلاس <code dir="ltr">page-break</code> صفحه‌ی جدید؛ متغیرهای CSS <code dir="ltr">--pt-primary</code> و <code dir="ltr">--pt-font</code> از سربرگ می‌آیند.</li>
                    <li>اسکریپت، فرم، iframe و رویدادهای <code dir="ltr">on…</code> به دلایل امنیتی حذف می‌شوند.</li>
                  </ul>
                </div>
              }
            }
          </div>

          @if (error()) {
            <div class="alert alert-danger py-2 mt-2 mb-0 small">{{ error() }}</div>
          }

          <div class="preview-title">پیش‌نمایش (داده‌ی نمونه)</div>
          <iframe class="preview" sandbox="" title="پیش‌نمایش قالب" [srcdoc]="preview()"></iframe>
        }
      </div>
    </div>
  `,
  styles: [`
    .designer { display: grid; grid-template-columns: 220px 1fr; gap: 1rem; align-items: start; }
    .tpl-list { border: 1px solid var(--bs-border-color, #e5e7eb); border-radius: .5rem; padding: .35rem; }
    .tpl-group { font-size: .75rem; font-weight: 600; color: var(--bs-secondary-color, #6b7280); padding: .5rem .5rem .2rem; }
    .tpl-item { display: flex; justify-content: space-between; align-items: center; gap: .25rem; width: 100%; text-align: right;
      border: 0; background: none; padding: .45rem .6rem; border-radius: .4rem; font-size: .88rem; }
    .tpl-item:hover { background: var(--bs-tertiary-bg, #f3f4f6); }
    .tpl-item.active { background: color-mix(in srgb, var(--bs-primary, #0d6efd) 12%, transparent); color: var(--bs-primary, #0d6efd); font-weight: 600; }
    .tpl-editor { min-width: 0; }
    .editor-pane { border: 1px solid var(--bs-border-color, #dee2e6); border-top: 0; border-radius: 0 0 .5rem .5rem; padding: .5rem; }
    .code { font-family: Consolas, 'Courier New', monospace; font-size: 12.5px; min-height: 320px; resize: vertical; white-space: pre; tab-size: 2; }
    .vars { max-height: 320px; overflow: auto; }
    .help li { margin-bottom: .35rem; }
    .preview-title { font-weight: 600; margin: 1rem 0 .4rem; }
    .preview { width: 100%; height: 640px; border: 1px solid var(--bs-border-color, #dee2e6); border-radius: .5rem; background: #fff; }
    @media (max-width: 992px) { .designer { grid-template-columns: 1fr; } }
  `],
})
export class PrintTemplateDesignerComponent {
  private readonly print = inject(PrintService);
  private readonly api = inject(PrintSettingsApiService);
  private readonly tus = inject(TusUploadService);
  private readonly toast = inject(ToastService);
  private readonly domSanitizer = inject(DomSanitizer);

  readonly settings = input.required<PrintSettingsModel>();
  readonly changed = output<void>();

  private readonly htmlArea = viewChild<ElementRef<HTMLTextAreaElement>>('htmlArea');

  readonly groups = (['layout', 'document', 'report'] as const).map(kind => ({
    kind,
    title: KIND_TITLES[kind],
    items: PRINT_TEMPLATES.filter(t => t.kind === kind),
  }));

  /** نمونه‌های نحو قالب برای راهنما (به‌صورت ثابت تا با درون‌یابی انگولار تداخل نکند) */
  readonly syntax = {
    content: '{{{content}}}',
    text: '{{meeting.title}}',
    html: '{{{resolution.text}}}',
    each: '{{#each members}} … {{else}} … {{/each}}',
    number: '{{@number}}',
    self: '{{this}}',
    ifBlock: '{{#if signers}} … {{else}} … {{/if}}',
    unless: '{{#unless …}}',
    comment: '{{! توضیح }}',
  };

  readonly selectedKey = signal<string>('minutes');
  readonly tab = signal<EditorTab>('html');
  readonly html = signal('');
  readonly css = signal('');
  readonly busy = signal(false);

  private readonly saved = signal<TemplateSource>({ html: '', css: '' });
  private readonly layout = signal<TemplateSource | null>(null);
  private readonly logoUrl = signal('');

  readonly definition = computed(() => getPrintTemplate(this.selectedKey()));
  readonly dirty = computed(() => this.html() !== this.saved().html || this.css() !== this.saved().css);
  readonly error = computed(() => validateTemplate(this.html()));

  /** سند کامل پیش‌نمایش؛ قالب ناقص (در حین تایپ) پیش‌نمایش قبلی را خراب نمی‌کند */
  private lastPreview: SafeHtml = '';
  readonly preview = computed<SafeHtml>(() => {
    const def = this.definition();
    const layout = def?.key === 'layout' ? { html: this.html(), css: this.css() } : this.layout();
    if (!def || !layout || this.error()) return this.lastPreview;

    try {
      const doc = this.print.compose({
        definition: def,
        template: { html: this.html(), css: this.css() },
        layout,
        data: def.sampleData,
        branding: this.settings().branding,
        logoUrl: this.logoUrl(),
        options: { title: def.key === 'layout' ? 'عنوان سند' : def.title, watermark: def.sampleData['isDraft'] ? 'پیش‌نویس' : undefined },
      });
      // سند خروجی پاک‌سازی شده و در iframe با sandbox خالی (بدون اسکریپت) نمایش داده می‌شود
      this.lastPreview = this.domSanitizer.bypassSecurityTrustHtml(doc);
    } catch {
      // قالب در حال ویرایش است؛ پیش‌نمایش قبلی می‌ماند
    }
    return this.lastPreview;
  });

  constructor() {
    effect(() => {
      const settings = this.settings();
      void this.loadContext(settings);
    });
  }

  isCustom(key: string): boolean {
    return !!this.print.templateGuid(this.settings(), key);
  }

  async select(key: string): Promise<void> {
    if (key === this.selectedKey()) return;
    if (this.dirty() && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) return;
    this.selectedKey.set(key);
    await this.loadSelected();
  }

  loadDefault(): void {
    const def = this.definition();
    if (!def) return;
    this.html.set(def.defaultHtml);
    this.css.set(def.defaultCss);
  }

  insertVariable(v: PrintVariable): void {
    const snippet = this.snippetFor(v);
    this.tab.set('html');
    // پس از رندر textarea
    queueMicrotask(() => {
      const el = this.htmlArea()?.nativeElement;
      const current = this.html();
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      this.html.set(current.slice(0, start) + snippet + current.slice(end));
      if (el) {
        el.value = this.html();
        el.focus();
        el.selectionStart = el.selectionEnd = start + snippet.length;
      }
    });
  }

  async save(): Promise<void> {
    const def = this.definition();
    if (!def || this.error()) return;

    const content: PrintTemplateContent = {
      version: 1,
      html: this.html(),
      css: this.css(),
      updatedAt: new Date().toISOString(),
    };

    this.busy.set(true);
    try {
      const file = new File([JSON.stringify(content)], `print-template-${def.key}.json`, { type: 'application/json' });
      const guid = await this.tus.uploadDetached(file, 'Print/Templates', `قالب چاپ: ${def.title}`);
      await firstValueFrom(this.api.setTemplate(def.key, guid));
      this.print.rememberTemplateContent(guid, content);
      this.saved.set({ html: content.html, css: content.css });
      this.toast.success(`قالب «${def.title}» ذخیره شد.`);
      this.changed.emit();
    } catch (e: any) {
      if (e?.message) this.toast.error(e.message);
    } finally {
      this.busy.set(false);
    }
  }

  async resetToDefault(): Promise<void> {
    const def = this.definition();
    if (!def || !confirm(`قالب «${def.title}» به حالت پیش‌فرض برگردد؟`)) return;

    this.busy.set(true);
    try {
      await firstValueFrom(this.api.setTemplate(def.key, null));
      this.saved.set({ html: def.defaultHtml, css: def.defaultCss });
      this.loadDefault();
      this.toast.success('قالب به حالت پیش‌فرض برگشت.');
      this.changed.emit();
    } catch {
      // پیام خطا توسط HttpService نمایش داده می‌شود
    } finally {
      this.busy.set(false);
    }
  }

  /** چاپ همین محتوای ویرایشگر (حتی ذخیره‌نشده) با داده‌ی نمونه */
  testPrint(): void {
    const def = this.definition();
    const layout = def?.key === 'layout' ? { html: this.html(), css: this.css() } : this.layout();
    if (!def || !layout) return;

    const target = this.print.openWindow();
    if (!target) {
      this.toast.error('پنجره‌ی چاپ باز نشد؛ لطفاً اجازه‌ی باز شدن پنجره‌ی جدید (Pop-up) را بدهید.');
      return;
    }
    const doc = this.print.compose({
      definition: def,
      template: { html: this.html(), css: this.css() },
      layout,
      data: def.sampleData,
      branding: this.settings().branding,
      logoUrl: this.logoUrl(),
      options: { title: def.title, watermark: def.sampleData['isDraft'] ? 'پیش‌نویس' : undefined },
    });
    void this.print.writeAndPrint(target, doc);
  }

  // ───────────────────────── داخلی ─────────────────────────

  private async loadContext(settings: PrintSettingsModel): Promise<void> {
    const [layout, logoUrl] = await Promise.all([
      this.print.getTemplate('layout', settings),
      this.print.resolveLogoUrl(settings.branding),
    ]);
    this.layout.set({ html: layout.html, css: layout.css });
    this.logoUrl.set(logoUrl);
    if (!this.dirty()) await this.loadSelected();
  }

  private async loadSelected(): Promise<void> {
    const template = await this.print.getTemplate(this.selectedKey(), this.settings());
    this.saved.set({ html: template.html, css: template.css });
    this.html.set(template.html);
    this.css.set(template.css);
  }

  private snippetFor(v: PrintVariable): string {
    const name = v.name.split(/\s*\/\s*/)[0].trim();
    if (name.endsWith('[]')) {
      const list = name.slice(0, -2);
      return `{{#each ${list}}}\n  \n{{/each}}`;
    }
    return /HTML/.test(v.description) ? `{{{${name}}}}` : `{{${name}}}`;
  }
}
