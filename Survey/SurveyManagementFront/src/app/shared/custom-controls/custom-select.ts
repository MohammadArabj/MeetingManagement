import { Component, input, output, signal, computed, OnInit, inject, effect, ViewEncapsulation } from '@angular/core';
import { NgSelectComponent, NgSelectModule } from '@ng-select/ng-select';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable, of, catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { SelectType } from '../../core/types/configuration';
import { CustomControlComponent } from './custom-control';
import { CommonModule } from '@angular/common';
import { ComboBase } from '../combo-base';

export interface SelectOption {
  guid: string;
  title: string;
  value?: any;
  disabled?: boolean;
  group?: string;
  id?: string;
  name?: string;
}

@Component({
  selector: 'custom-select',
  standalone: true,
  imports: [NgSelectModule, FormsModule, CommonModule],
  template: `
    <div [class]="containerClass()">
      @if (styleType() === 'group') {
        <label [for]="identity()" class="input-group-text">
          {{label()}}
          @if (isRequired()) {
            <span class="text-danger"> *</span>
          }
        </label>
      } @else {
        <label [for]="identity()" class="form-label">
          {{label()}}
          @if (isRequired()) {
            <span class="text-danger"> *</span>
          }
        </label>
      }

      @switch (type()) {
        @case ('simple') {
          <select
            class="form-select {{classInput()}}"
            [id]="identity()"
            [name]="identity()"
            [disabled]="isDisabled()"
            [value]="value()"
            (change)="handleSimpleSelect($event)"
            [attr.required]="isRequired() || null"
            [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
            <option value="">{{placeholder() || 'انتخاب کنید'}}</option>
            @for (option of options(); track option.guid) {
              <option [value]="option.guid" [disabled]="option.disabled">
                {{option.title}}
              </option>
            }
          </select>
        }

        @case ('multiple') {
          <ng-select
            class="flex-grow-1"
            [id]="identity()"
            [name]="identity()"
            [items]="selectOptions()"
            [multiple]="true"
            bindLabel="title"
            [bindValue]="bindValue()"
            [ngModel]="value()"
            [placeholder]="placeholder() || 'انتخاب کنید'"
            [disabled]="isDisabled()"
            [required]="isRequired()??false"
            [clearable]="clearable()"
            [searchable]="searchable()"
            [loading]="isLoading()"
            [maxSelectedItems]="maxSelectedItems()"
            (ngModelChange)="handleNgSelectChange($event)"
            (open)="handleOpen()"
            (close)="handleClose()"
            (clear)="handleClear()"
            [attr.aria-describedby]="hasError() ? identity() + '-error' : null">

            @if (customOptionTemplate()) {
              @for(option of selectOptions();track $index){
                <ng-template ng-option-tmp let-option="item">
                  <ng-container
                    [ngTemplateOutlet]="customOptionTemplate()"
                    [ngTemplateOutletContext]="{ option: option }">
                  </ng-container>
                </ng-template>
              }

            }
          </ng-select>
        }

        @case ('select') {
          <ng-select
            class="flex-grow-1"
            [id]="identity()"
            [name]="identity()"
            [items]="selectOptions()"
            bindLabel="title"
            [bindValue]="bindValue()"
            [ngModel]="value()"
            [placeholder]="placeholder() || 'انتخاب کنید'"
            [disabled]="isDisabled()"
            [required]="isRequired()??false"
            [clearable]="clearable()"
            [searchable]="searchable()"
            [loading]="isLoading()"
            (ngModelChange)="handleNgSelectChange($event)"
            (open)="handleOpen()"
            (close)="handleClose()"
            (clear)="handleClear()"
            [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          </ng-select>
        }

        @case ('select-ajax') {
          <ng-select
            class="flex-grow-1"
            [id]="identity()"
            [name]="identity()"
            [items]="selectOptions()"
            bindLabel="title"
            [bindValue]="bindValue()"
            [ngModel]="value()"
            [placeholder]="placeholder() || 'انتخاب کنید'"
            [disabled]="isDisabled()"
            [required]="isRequired()??false"
            [searchable]="true"
            [clearable]="clearable()"
            [virtualScroll]="true"
            [loading]="isLoading()"
            (ngModelChange)="handleNgSelectChange($event)"
            (open)="handleOpen()"
            (close)="handleClose()"
            (clear)="handleClear()"
            (typeahead)="handleSearch($event)"
            [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
            @for(option of selectOptions();track $index){
              <option  [value]="option.guid" [disabled]="option.disabled">
              {{option.title}}
            </option>
            }

          </ng-select>
        }
      }

      <ng-content></ng-content>

      @if (helpText()) {
        <div class="form-text">{{helpText()}}</div>
      }

      @if (hasError()) {
        <div [id]="identity() + '-error'" class="invalid-feedback d-block">
          @for (message of errorMessages(); track $index) {
            <div>{{message}}</div>
          }
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    /* 
       استایل‌های جدید برای هماهنگی کامل با .form-control و .in 
       استفاده از متغیرهای CSS شما (--line, --ink و ...)
    */

    /* تنظیمات کانتینر اصلی ng-select */
    .ng-select .ng-select-container {
      width: 100%;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, .92);
      padding: 10px 12px; /* هماهنگ با سایر اینپوت‌ها */
      border-radius: 14px;
      min-height: 50px;
      align-items: center;
      color: var(--ink);
      transition: .15s ease;
      outline: none;
      box-shadow: none;
    }

    /* حالت فوکوس */
    .ng-select.ng-select-focused:not(.ng-select-opened) > .ng-select-container,
    .ng-select.ng-select-opened > .ng-select-container {
      border-color: rgba(29, 78, 216, .35) !important;
      box-shadow: 0 0 0 4px rgba(29, 78, 216, .12) !important;
      background: rgba(255, 255, 255, .92);
    }

   /* Placeholder دقیقاً در وسط */
.ng-select .ng-placeholder {
  color: var(--muted);
  top: 10px !important; /* هم‌اندازه با Padding بالا */
  left: 12px !important; /* هم‌اندازه با Padding چپ */
  transform: none !important; /* حذف ترنسفرم قبلی */
  line-height: 30px !important; /* ارتفاع داخلی کانتینر (50 - 10 بالا - 10 پایین) */
}

/* اطمینان از اینکه کانتینر مقدار همیشه دقیق است */
.ng-select.ng-select-single .ng-value-container {
  align-items: center;
  height: 100%;
}
    /* متن داخل سلکت (متن انتخاب شده) */
    .ng-select .ng-value-container {
      padding-left: 0 !important;
      padding-right: 25px !important; /* جا برای آیکون */
    }
    
    [dir="rtl"] .ng-select .ng-value-container {
      padding-right: 0 !important;
      padding-left: 25px !important;
    }

    /* آیتم‌های انتخاب شده در حالت Multiple */
    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value {
      background-color: rgba(29, 78, 216, 0.1);
      color: #1d4ed8;
      border-radius: 8px;
      font-size: 0.9em;
      margin-right: 5px;
      margin-bottom: 5px;
    }
    [dir="rtl"] .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value {
      margin-right: 0;
      margin-left: 5px;
    }

    /* آیکون پاک کردن (X) */
    .ng-select .ng-clear-wrapper {
      color: var(--muted) !important;
    }
    .ng-select .ng-clear-wrapper:hover .ng-clear {
      color: var(--ink) !important;
    }

    /* آیکون فلش */
    .ng-select .ng-arrow-wrapper .ng-arrow {
      border-color: var(--ink) rgba(0, 0, 0, 0) rgba(0, 0, 0, 0);
      border-width: 5px 5px 2.5px;
    }
    .ng-select.ng-select-opened .ng-arrow {
      border-width: 0 5px 5px;
    }

    /* منوی بازشو (Dropdown) */
    .ng-dropdown-panel {
      background: rgba(255, 255, 255, .98);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      margin-top: 5px;
    }

    /* آیتم‌های داخل لیست */
    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option {
      padding: 10px 12px;
      color: var(--ink);
      transition: background .15s ease;
    }

    /* هاور روی آیتم‌ها */
    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-marked {
      background-color: rgba(29, 78, 216, 0.05);
      color: var(--ink);
    }

    /* آیتم انتخاب شده در لیست */
    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-selected {
      background-color: rgba(29, 78, 216, 0.1);
      color: #1d4ed8;
      font-weight: bold;
    }
    
    /* متن کم رنگ برای آیتم‌های غیرفعال */
    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-disabled {
      color: var(--muted);
    }

    /* ارتفاع دقیق برای حالت سینگل (یک انتخابی) */
    .ng-select.ng-select-single .ng-select-container {
      height: 50px;
    }
    .invalid-feedback{
      font-size: 0.875em;
      color: var(--danger);
    }
  `,
  host: {
    '[attr.data-component]': '"custom-select"'
  }
})
export class CustomSelectComponent extends CustomControlComponent implements OnInit {
  private http = inject(HttpClient);

  // Input properties
  type = input<SelectType>('select');
  options = input<ComboBase[]>([]);
  ajaxUrl = input<string>('');
  searchable = input<boolean>(true);
  clearable = input<boolean>(true);
  maxSelectedItems = input<number>();
  minSearchLength = input<number>(2);
  customOptionTemplate = input<any>();
  bindValue = input<string>('guid'); // پیش‌فرض guid

  // Output signals
  selected = output<any>();
  opened = output<void>();
  closed = output<void>();
  cleared = output<void>();
  searched = output<string>();

  // Internal state
  public isLoading = signal<boolean>(false);
  private searchTerm = signal<string>('');
  private ajaxOptions = signal<ComboBase[]>([]);
  private internalOptions = signal<ComboBase[]>(this.options());

  selectOptions = computed(() => {
    const defaultOption: ComboBase = {
      guid: '',
      title: 'انتخاب کنید',
      disabled: true
    };

    const baseOptions = this.type() === 'select-ajax'
      ? (this.ajaxOptions() || [])
      : (this.internalOptions() || []);

    return [defaultOption, ...baseOptions];
  });
  containerClass = computed(() => {
    const baseClass = this.styleType() === 'group' ? 'input-group mb-1 mt-1' : 'form-group';
    return baseClass;
  });

  constructor() {
    super();
    effect(() => {
      this.internalOptions.set(this.options());
    });

  }

  override ngOnInit(): void {
    super.ngOnInit();

    if (this.type() === 'select-ajax' && this.ajaxUrl()) {
      this.loadInitialAjaxData();
    }
  }

  // Event handlers
  protected handleSimpleSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedValue = target.value || null;

    this.value.set(selectedValue);
    this.onChange(selectedValue);
    this.changed.emit(selectedValue);
    this.selected.emit(selectedValue);
  }

  protected handleNgSelectChange(selectedValue: any): void {
    this.value.set(selectedValue);
    this.onChange(selectedValue);
    this.changed.emit(selectedValue);
    this.selected.emit(selectedValue);
  }

  protected handleOpen(): void {
    this.opened.emit();
  }

  protected handleClose(): void {
    this.closed.emit();
  }

  protected handleClear(): void {
    this.value.set(null);
    this.onChange(null);
    this.changed.emit(null);
    this.cleared.emit();
  }

  protected handleSearch(term: any): void {
    this.searchTerm.set(term);
    this.searched.emit(term);

    if (this.type() === 'select-ajax' && this.ajaxUrl()) {
      this.performAjaxSearch(term);
    }
  }

  // Ajax functionality
  private loadInitialAjaxData(): void {
    if (!this.ajaxUrl()) return;

    this.isLoading.set(true);
    this.performAjaxRequest().subscribe({
      next: (data) => {
        this.ajaxOptions.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private performAjaxSearch(term: string): void {
    if (term.length < this.minSearchLength()) {
      return;
    }

    this.isLoading.set(true);
    this.performAjaxRequest(term).subscribe({
      next: (data) => {
        this.ajaxOptions.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private performAjaxRequest(searchTerm?: string): Observable<ComboBase[]> {
    const url = this.buildAjaxUrl(searchTerm);

    return this.http.get<any>(url).pipe(
      switchMap(response => {
        // Handle different response formats
        const data = response.data || response.items || response;
        const options = Array.isArray(data) ? data : [];

        return of(options.map(item => ({
          guid: item.id || item.guid || item.value,
          title: item.name || item.title || item.label || String(item),
          value: item,
          disabled: item.disabled || false
        })));
      }),
      catchError(() => of([])),
      debounceTime(300),
      distinctUntilChanged()
    );
  }

  private buildAjaxUrl(searchTerm?: string): string {
    let url = this.ajaxUrl();

    if (searchTerm) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}search=${encodeURIComponent(searchTerm)}`;
    }

    return url;
  }

  // Public methods
  refresh(): void {
    if (this.type() === 'select-ajax') {
      this.loadInitialAjaxData();
    }
  }


  addOption(option: ComboBase): void {
    this.internalOptions.update(options => [...options, option]);
  }

  removeOption(guid: string): void {
    this.internalOptions.update(options => options.filter(opt => opt.guid !== guid));
  }
}