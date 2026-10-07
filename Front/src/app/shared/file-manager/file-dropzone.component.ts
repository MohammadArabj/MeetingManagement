import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * ناحیه کشیدن و رها کردن / انتخاب فایل همراه با نمایش محدودیت‌ها و فرمت‌های مجاز.
 * رویدادهای drag روی پنل والد مدیریت می‌شوند؛ این کامپوننت فقط وضعیت `dragging` را نمایش می‌دهد.
 */
@Component({
  selector: 'app-file-dropzone',
  standalone: true,
  template: `
    <div class="dropzone" [class.dropzone--dragging]="dragging" (click)="pick.emit()">
      <div class="dropzone__icon">
        <i class="fas fa-cloud-upload-alt"></i>
        <div class="dropzone__icon-ring"></div>
      </div>
      <div class="dropzone__content">
        <p class="dropzone__title">فایل‌ها را بکشید و رها کنید</p>
        <p class="dropzone__subtitle">یا کلیک کنید برای انتخاب</p>

        <!-- ✅ نمایش محدودیت‌ها -->
        <div class="dropzone__hints">
          <span class="hint">
            <i class="fas fa-weight-hanging"></i>
            حداکثر {{ maxFileSizeMB }} مگابایت
          </span>
          @if (multiple) {
            <span class="hint">
              <i class="fas fa-layer-group"></i>
              حداکثر {{ maxFiles }} فایل
            </span>
          }
        </div>

        <!-- ✅ نمایش فرمت‌های مجاز -->
        <div class="dropzone__formats">
          <p class="formats-title">
            <i class="fas fa-file-check"></i>
            فرمت‌های مجاز:
          </p>
          <div class="formats-grid">
            {{ fileTypeCategories }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .dropzone {
      background: var(--fm-surface); border: 2px dashed var(--fm-border);
      border-radius: var(--fm-radius-lg); padding: 1.5rem;
      display: flex; align-items: center; gap: 1.25rem;
      cursor: pointer; transition: var(--fm-transition); margin-bottom: 1.25rem;
    }
    .dropzone:hover { border-color: var(--fm-accent); background: var(--fm-surface-hover); }
    .dropzone--dragging { border-color: var(--fm-accent); background: rgba(240, 189, 5, 0.08); }

    .dropzone__icon {
      position: relative; width: 64px; height: 64px; flex-shrink: 0;
      display: grid; place-items: center;
      background: linear-gradient(135deg, rgba(240, 189, 5, 0.15) 0%, rgba(240, 189, 5, 0.08) 100%);
      border-radius: var(--fm-radius-lg); font-size: 1.5rem; color: var(--fm-accent-dark);
    }
    .dropzone__icon-ring {
      position: absolute; inset: -4px; border: 2px dashed var(--fm-accent);
      border-radius: calc(var(--fm-radius-lg) + 4px); opacity: 0.4;
      animation: spin 20s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .dropzone__title { margin: 0; font-size: 1rem; font-weight: 700; color: var(--fm-text); }
    .dropzone__subtitle { margin: 0.25rem 0 0; font-size: 0.8125rem; color: var(--fm-text-secondary); }
    .dropzone__hints { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
    .hint {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.25rem 0.625rem; background: var(--fm-bg);
      border: 1px solid var(--fm-border); border-radius: 999px;
      font-size: 0.75rem; color: var(--fm-text-secondary);
    }
    .hint i { font-size: 0.625rem; color: var(--fm-accent-dark); }

    .dropzone__formats {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px dashed var(--fm-border);
      width: 100%;
    }
    .formats-title {
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      margin: 0 0 0.75rem;
      font-size: 0.8125rem; font-weight: 600; color: var(--fm-text-secondary);
    }
    .formats-title i { color: var(--fm-accent-dark); }
    .formats-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }

    @media (max-width: 768px) {
      .dropzone { flex-direction: column; text-align: center; }
      .formats-grid { flex-direction: column; align-items: stretch; }
    }
  `],
})
export class FileDropzoneComponent {
  @Input() dragging = false;
  @Input() multiple = true;
  @Input() maxFiles: number | null = null;
  @Input() maxFileSizeMB: number | null = null;
  /** فهرست فرمت‌های مجاز (همان مقداری که قبلاً مستقیماً در قالب درج می‌شد) */
  @Input() fileTypeCategories = '';

  @Output() pick = new EventEmitter<void>();
}
