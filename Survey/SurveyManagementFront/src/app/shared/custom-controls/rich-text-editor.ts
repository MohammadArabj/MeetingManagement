import {
    Component,
    ElementRef,
    ViewChild,
    AfterViewInit,
    OnDestroy,
    Input,
    forwardRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface ToolbarBtn {
    cmd: string;
    icon: string;
    title: string;
    value?: string;
}

@Component({
    selector: 'app-rich-text-editor',
    standalone: true,
    imports: [CommonModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => RichTextEditorComponent),
            multi: true,
        },
    ],
    template: `
    <div class="rteWrap" [class.disabled]="isDisabled">
      <!-- Toolbar -->
      <div class="rteToolbar">
        <div class="rteToolbar__group">
          @for (btn of formatButtons; track btn.cmd) {
            <button
              type="button"
              class="rteBtn"
              [class.active]="activeStates[btn.cmd]"
              [title]="btn.title"
              (mousedown)="$event.preventDefault()"
              (click)="exec(btn.cmd, btn.value)">
              <i [class]="'fa fa-' + btn.icon"></i>
            </button>
          }
        </div>

        <div class="rteToolbar__sep"></div>

        <div class="rteToolbar__group">
          @for (btn of alignButtons; track btn.cmd) {
            <button
              type="button"
              class="rteBtn"
              [class.active]="activeStates[btn.cmd]"
              [title]="btn.title"
              (mousedown)="$event.preventDefault()"
              (click)="exec(btn.cmd)">
              <i [class]="'fa fa-' + btn.icon"></i>
            </button>
          }
        </div>

        <div class="rteToolbar__sep"></div>

        <div class="rteToolbar__group">
          @for (btn of listButtons; track btn.cmd) {
            <button
              type="button"
              class="rteBtn"
              [title]="btn.title"
              (mousedown)="$event.preventDefault()"
              (click)="exec(btn.cmd)">
              <i [class]="'fa fa-' + btn.icon"></i>
            </button>
          }
        </div>

        <div class="rteToolbar__sep"></div>

        <!-- اندازه متن -->
        <select
          class="rteSelect"
          title="اندازه متن"
          (mousedown)="$event.stopPropagation()"
          (change)="setFontSize($event)">
          <option value="">اندازه</option>
          <option value="2">کوچک</option>
          <option value="3" selected>معمولی</option>
          <option value="5">بزرگ</option>
          <option value="7">خیلی بزرگ</option>
        </select>

        <div class="rteToolbar__sep"></div>

        <!-- رنگ متن -->
        <label class="rteColorBtn" title="رنگ متن">
          <i class="fa fa-font"></i>
          <input
            type="color"
            (mousedown)="$event.stopPropagation()"
            (input)="setColor($event, 'foreColor')">
        </label>

        <!-- رنگ هایلایت -->
        <label class="rteColorBtn" title="رنگ پس‌زمینه متن">
          <i class="fa fa-highlighter"></i>
          <input
            type="color"
            (mousedown)="$event.stopPropagation()"
            (input)="setColor($event, 'hiliteColor')">
        </label>

        <div class="rteToolbar__sep"></div>

        <button
          type="button"
          class="rteBtn"
          title="درج لینک"
          (mousedown)="$event.preventDefault()"
          (click)="insertLink()">
          <i class="fa fa-link"></i>
        </button>

        <button
          type="button"
          class="rteBtn"
          title="پاک کردن استایل"
          (mousedown)="$event.preventDefault()"
          (click)="exec('removeFormat')">
          <i class="fa fa-eraser"></i>
        </button>
      </div>

      <!-- Editable Area -->
      <div
        #editor
        class="rteEditor"
        contenteditable="true"
        dir="rtl"
        [attr.data-placeholder]="placeholder"
        (input)="onContentChange()"
        (blur)="onTouched()"
        (mouseup)="updateActiveStates()"
        (keyup)="updateActiveStates()">
      </div>
    </div>
  `,
    styles: [`
    .rteWrap {
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      background: rgba(255, 255, 255, .92);
      transition: .15s ease;
    }
    .rteWrap:focus-within {
      border-color: rgba(29, 78, 216, .35);
      box-shadow: 0 0 0 4px rgba(29, 78, 216, .12);
    }
    .rteWrap.disabled { opacity: .6; pointer-events: none; }

    .rteToolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      padding: 8px 10px;
      background: rgba(249, 250, 251, .9);
      border-bottom: 1px solid var(--line);
    }
    .rteToolbar__group { display: flex; gap: 2px; }
    .rteToolbar__sep {
      width: 1px; height: 22px;
      background: var(--line);
      margin: 0 4px;
    }

    .rteBtn {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border: 1px solid transparent;
      background: transparent;
      border-radius: 8px;
      color: var(--muted);
      font-size: .9rem;
      cursor: pointer;
      transition: all .15s ease;
    }
    .rteBtn:hover { background: rgba(29, 78, 216, .08); color: var(--primary); }
    .rteBtn.active {
      background: rgba(29, 78, 216, .14);
      border-color: rgba(29, 78, 216, .25);
      color: var(--primary);
    }

    .rteSelect {
      height: 32px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      font-size: .82rem;
      font-weight: 700;
      color: var(--ink);
      padding: 0 8px;
      cursor: pointer;
      outline: none;
    }

    .rteColorBtn {
      position: relative;
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px;
      color: var(--muted);
      cursor: pointer;
      transition: all .15s ease;
    }
    .rteColorBtn:hover { background: rgba(29, 78, 216, .08); color: var(--primary); }
    .rteColorBtn input[type="color"] {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      width: 100%;
      height: 100%;
    }

    .rteEditor {
      min-height: 120px;
      max-height: 400px;
      overflow-y: auto;
      padding: 14px 16px;
      outline: none;
      font-size: .95rem;
      line-height: 1.9;
      color: var(--ink);
    }
    .rteEditor:empty::before {
      content: attr(data-placeholder);
      color: var(--muted);
      pointer-events: none;
    }
    .rteEditor ul, .rteEditor ol {
      padding-right: 24px;
      padding-left: 0;
      margin: 8px 0;
    }
    .rteEditor a { color: var(--primary); text-decoration: underline; }
  `],
})
export class RichTextEditorComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
    @ViewChild('editor', { static: true }) editorRef!: ElementRef<HTMLDivElement>;
    @Input() placeholder = 'متن خود را اینجا بنویسید...';

    isDisabled = false;
    activeStates: Record<string, boolean> = {};

    readonly formatButtons: ToolbarBtn[] = [
        { cmd: 'bold', icon: 'bold', title: 'ضخیم' },
        { cmd: 'italic', icon: 'italic', title: 'مورب' },
        { cmd: 'underline', icon: 'underline', title: 'خط زیر' },
        { cmd: 'strikeThrough', icon: 'strikethrough', title: 'خط خورده' },
    ];

    readonly alignButtons: ToolbarBtn[] = [
        { cmd: 'justifyRight', icon: 'align-right', title: 'راست‌چین' },
        { cmd: 'justifyCenter', icon: 'align-center', title: 'وسط‌چین' },
        { cmd: 'justifyLeft', icon: 'align-left', title: 'چپ‌چین' },
        { cmd: 'justifyFull', icon: 'align-justify', title: 'تراز کامل' },
    ];

    readonly listButtons: ToolbarBtn[] = [
        { cmd: 'insertUnorderedList', icon: 'list-ul', title: 'لیست نامرتب' },
        { cmd: 'insertOrderedList', icon: 'list-ol', title: 'لیست مرتب' },
    ];

    private onChange: (value: string) => void = () => { };
    onTouched: () => void = () => { };

    private readonly onSelectionChange = () => this.updateActiveStates();

    ngAfterViewInit(): void {
        document.addEventListener('selectionchange', this.onSelectionChange);
    }

    ngOnDestroy(): void {
        document.removeEventListener('selectionchange', this.onSelectionChange);
    }

    // ==================== ControlValueAccessor ====================
    writeValue(value: string): void {
        const html = value || '';
        if (this.editorRef?.nativeElement && this.editorRef.nativeElement.innerHTML !== html) {
            this.editorRef.nativeElement.innerHTML = html;
        }
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.isDisabled = isDisabled;
    }

    // ==================== Editor Logic ====================
    onContentChange(): void {
        this.onChange(this.editorRef.nativeElement.innerHTML);
    }

    exec(cmd: string, value?: string): void {
        this.editorRef.nativeElement.focus();
        document.execCommand(cmd, false, value);
        this.onContentChange();
        this.updateActiveStates();
    }

    setFontSize(event: Event): void {
        const size = (event.target as HTMLSelectElement).value;
        if (!size) return;
        this.exec('fontSize', size);
        (event.target as HTMLSelectElement).value = '';
    }

    setColor(event: Event, cmd: 'foreColor' | 'hiliteColor'): void {
        const color = (event.target as HTMLInputElement).value;
        this.exec(cmd, color);
    }

    insertLink(): void {
        const url = window.prompt('آدرس لینک را وارد کنید:', 'https://');
        if (url) this.exec('createLink', url);
    }

    updateActiveStates(): void {
        if (!this.editorRef?.nativeElement) return;
        const commands = [
            'bold', 'italic', 'underline', 'strikeThrough',
            'justifyRight', 'justifyCenter', 'justifyLeft', 'justifyFull',
        ];
        const states: Record<string, boolean> = {};
        for (const cmd of commands) {
            try { states[cmd] = document.queryCommandState(cmd); } catch { states[cmd] = false; }
        }
        this.activeStates = states;
    }
}