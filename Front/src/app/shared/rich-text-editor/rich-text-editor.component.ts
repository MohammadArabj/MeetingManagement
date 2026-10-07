import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, booleanAttribute, computed, forwardRef,
  input, numberAttribute, signal, viewChild,
} from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';

import { isRichHtml, isRichTextEmpty, plainTextToHtml, richTextToPlain } from '../../core/rich-text/rich-text';

interface ToolbarButton {
  key: string;
  icon: string;
  title: string;
  run: (e: Editor) => void;
  active?: (e: Editor) => boolean;
  disabled?: (e: Editor) => boolean;
}

/**
 * ویرایشگر متن قالب‌بندی‌شده (راست‌به‌چپ) برای شرح جلسه، توضیحات مصوبات، الحاقیه و ...
 * ─────────────────────────────────────────────────────────────────────────
 *  • مبتنی بر TipTap/ProseMirror؛ خروجی HTML تمیز و محدود (پاراگراف، عنوان، فهرست، نقل‌قول، تأکید، پیوند، تراز)
 *  • متن چسبانده‌شده از Word/وب به همین قالب‌ها تبدیل می‌شود (اسکریپت و استایل‌های اضافی حذف می‌شوند)
 *  • با Reactive Forms و ngModel کار می‌کند (ControlValueAccessor + Validator)
 *  • maxLength: سقف طول HTML ذخیره‌شده (هم‌اندازه‌ی ستون پایگاه داده)؛ شمارنده‌ی زنده و خطای اعتبارسنجی
 *  • مقدار ساده‌ی قدیمی (متن با خط جدید) خودکار به پاراگراف تبدیل می‌شود
 */
@Component({
  selector: 'app-rich-text-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditorComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => RichTextEditorComponent), multi: true },
  ],
  template: `
    <div class="rte" [class.rte--focused]="focused()" [class.rte--disabled]="disabled()" [class.rte--invalid]="overLimit()">
      @if (!disabled()) {
        <div class="rte-toolbar" role="toolbar" aria-label="ابزار قالب‌بندی">
          @for (group of groups; track $index) {
            <div class="rte-group">
              @for (b of group; track b.key) {
                <button type="button" class="rte-btn" [class.is-active]="isActive(b)" [disabled]="isDisabled(b)"
                        [title]="b.title" [attr.aria-label]="b.title" [attr.aria-pressed]="isActive(b)"
                        (mousedown)="$event.preventDefault()" (click)="exec(b)">
                  <i class="fa {{ b.icon }}"></i>
                </button>
              }
            </div>
          }
        </div>
      }
      <div #host class="rte-content mm-rich" [style.min-height.px]="minHeight()" [style.max-height.px]="maxHeight() || null"></div>
      @if (maxLength() || showCount()) {
        <div class="rte-footer">
          <span>{{ wordCount() }} کلمه</span>
          @if (maxLength()) {
            <span class="rte-count" [class.warn]="usage() > .9" [class.over]="overLimit()"
                  title="حجم ذخیره‌شده (همراه قالب‌بندی) نسبت به سقف مجاز">
              {{ length() }} / {{ maxLength() }}
            </span>
          }
        </div>
      }
      @if (overLimit()) {
        <div class="rte-error"><i class="fa fa-circle-exclamation"></i> متن (همراه قالب‌بندی) از سقف مجاز طولانی‌تر است؛ آن را کوتاه کنید یا قالب‌بندی را کم کنید.</div>
      }
    </div>
  `,
  styleUrl: './rich-text-editor.component.css',
})
export class RichTextEditorComponent implements AfterViewInit, OnDestroy, ControlValueAccessor, Validator {
  readonly placeholder = input('متن را بنویسید…');
  readonly maxLength = input(0, { transform: numberAttribute });
  readonly minHeight = input(160, { transform: numberAttribute });
  readonly maxHeight = input(0, { transform: numberAttribute });
  readonly showCount = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private editor: Editor | null = null;
  private pendingValue = '';

  readonly disabled = signal(false);
  readonly focused = signal(false);
  private readonly html = signal('');
  /** شمارنده‌ی تغییرات برای به‌روزرسانی وضعیت دکمه‌ها */
  private readonly tick = signal(0);

  readonly length = computed(() => this.html().length);
  readonly usage = computed(() => (this.maxLength() ? this.length() / this.maxLength() : 0));
  readonly overLimit = computed(() => !!this.maxLength() && this.length() > this.maxLength());
  readonly wordCount = computed(() => {
    const text = richTextToPlain(this.html()).trim();
    return text ? text.split(/\s+/).length : 0;
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};

  readonly groups: ToolbarButton[][] = [
    [
      { key: 'undo', icon: 'fa-rotate-right', title: 'واگرد (Ctrl+Z)', run: e => e.chain().focus().undo().run(), disabled: e => !e.can().undo() },
      { key: 'redo', icon: 'fa-rotate-left', title: 'ازنو (Ctrl+Y)', run: e => e.chain().focus().redo().run(), disabled: e => !e.can().redo() },
    ],
    [
      { key: 'h3', icon: 'fa-heading', title: 'عنوان', run: e => e.chain().focus().toggleHeading({ level: 3 }).run(), active: e => e.isActive('heading', { level: 3 }) },
      { key: 'bold', icon: 'fa-bold', title: 'پررنگ (Ctrl+B)', run: e => e.chain().focus().toggleBold().run(), active: e => e.isActive('bold') },
      { key: 'italic', icon: 'fa-italic', title: 'مورب (Ctrl+I)', run: e => e.chain().focus().toggleItalic().run(), active: e => e.isActive('italic') },
      { key: 'underline', icon: 'fa-underline', title: 'زیرخط (Ctrl+U)', run: e => e.chain().focus().toggleUnderline().run(), active: e => e.isActive('underline') },
      { key: 'strike', icon: 'fa-strikethrough', title: 'خط‌خورده', run: e => e.chain().focus().toggleStrike().run(), active: e => e.isActive('strike') },
      { key: 'highlight', icon: 'fa-highlighter', title: 'برجسته', run: e => e.chain().focus().toggleHighlight().run(), active: e => e.isActive('highlight') },
    ],
    [
      { key: 'ol', icon: 'fa-list-ol', title: 'فهرست شماره‌دار', run: e => e.chain().focus().toggleOrderedList().run(), active: e => e.isActive('orderedList') },
      { key: 'ul', icon: 'fa-list-ul', title: 'فهرست نقطه‌ای', run: e => e.chain().focus().toggleBulletList().run(), active: e => e.isActive('bulletList') },
      { key: 'quote', icon: 'fa-quote-right', title: 'نقل‌قول', run: e => e.chain().focus().toggleBlockquote().run(), active: e => e.isActive('blockquote') },
      { key: 'hr', icon: 'fa-minus', title: 'خط جداکننده', run: e => e.chain().focus().setHorizontalRule().run() },
    ],
    [
      { key: 'right', icon: 'fa-align-right', title: 'راست‌چین', run: e => e.chain().focus().setTextAlign('right').run(), active: e => e.isActive({ textAlign: 'right' }) },
      { key: 'center', icon: 'fa-align-center', title: 'وسط‌چین', run: e => e.chain().focus().setTextAlign('center').run(), active: e => e.isActive({ textAlign: 'center' }) },
      { key: 'left', icon: 'fa-align-left', title: 'چپ‌چین', run: e => e.chain().focus().setTextAlign('left').run(), active: e => e.isActive({ textAlign: 'left' }) },
      { key: 'justify', icon: 'fa-align-justify', title: 'تراز دوطرفه', run: e => e.chain().focus().setTextAlign('justify').run(), active: e => e.isActive({ textAlign: 'justify' }) },
    ],
    [
      { key: 'link', icon: 'fa-link', title: 'پیوند', run: e => this.toggleLink(e), active: e => e.isActive('link') },
      { key: 'clear', icon: 'fa-eraser', title: 'حذف قالب‌بندی', run: e => e.chain().focus().unsetAllMarks().clearNodes().run() },
    ],
  ];

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.host().nativeElement,
      editable: !this.disabled() && !this.readonly(),
      content: this.pendingValue,
      extensions: [
        StarterKit.configure({ heading: { levels: [3, 4] }, codeBlock: false, code: false }),
        Underline,
        Highlight,
        Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'],
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
        TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['right', 'center', 'left', 'justify'], defaultAlignment: 'right' }),
        Placeholder.configure({ placeholder: () => this.placeholder() }),
      ],
      editorProps: { attributes: { dir: 'rtl', class: 'rte-prose', spellcheck: 'false' } },
      onUpdate: ({ editor }) => {
        const value = normalize(editor.getHTML());
        this.html.set(value);
        this.onChange(value);
        this.onValidatorChange();
      },
      onSelectionUpdate: () => this.tick.update(n => n + 1),
      onTransaction: () => this.tick.update(n => n + 1),
      onFocus: () => this.focused.set(true),
      onBlur: () => { this.focused.set(false); this.onTouched(); },
    });
    this.html.set(normalize(this.editor.getHTML()));
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
    this.editor = null;
  }

  // ─────────────── ControlValueAccessor ───────────────

  writeValue(value: string | null): void {
    const html = toEditorHtml(value);
    this.pendingValue = html;
    if (this.editor && normalize(this.editor.getHTML()) !== normalize(html)) {
      this.editor.commands.setContent(html, false);
    }
    this.html.set(normalize(html));
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    this.editor?.setEditable(!isDisabled && !this.readonly());
  }

  // ─────────────── Validator ───────────────

  validate(_: AbstractControl): ValidationErrors | null {
    const max = this.maxLength();
    const actual = this.html().length;
    return max && actual > max ? { maxlength: { requiredLength: max, actualLength: actual } } : null;
  }

  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }

  // ─────────────── Toolbar ───────────────

  isActive(b: ToolbarButton): boolean {
    this.tick();
    return !!this.editor && !!b.active?.(this.editor);
  }

  isDisabled(b: ToolbarButton): boolean {
    this.tick();
    return !this.editor || !!b.disabled?.(this.editor);
  }

  exec(b: ToolbarButton): void {
    if (this.editor) b.run(this.editor);
  }

  focus(): void {
    this.editor?.commands.focus('end');
  }

  private toggleLink(e: Editor): void {
    if (e.isActive('link')) {
      e.chain().focus().unsetLink().run();
      return;
    }
    const url = prompt('آدرس پیوند (با http:// یا https://):', 'https://');
    if (!url || !/^(https?:\/\/|mailto:)/i.test(url.trim())) return;
    e.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }
}

/** مقدار ورودی (HTML یا متن ساده‌ی قدیمی) → HTML ویرایشگر */
function toEditorHtml(value: string | null | undefined): string {
  if (!value) return '';
  return isRichHtml(value) ? value : plainTextToHtml(value);
}

/**
 * ویرایشگر خالی «<p></p>» برمی‌گرداند؛ مقدار خالی واقعی ذخیره شود تا Validators.required کار کند.
 * تراز راست پیش‌فرض متن فارسی است؛ style تکراری آن حذف می‌شود تا سقف طول ستون پایگاه داده هدر نرود.
 */
function normalize(html: string): string {
  if (isRichTextEmpty(html)) return '';
  return html.replace(/ style="text-align: ?right;?"/g, '');
}
