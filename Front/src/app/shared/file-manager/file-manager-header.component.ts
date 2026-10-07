import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ViewMode } from './file-manager.models';

/**
 * هدر مودال مدیریت فایل: عنوان، آمار، تغییر حالت نمایش، افزودن فایل و بستن.
 * کاملاً نمایشی است؛ همه اقدام‌ها به والد ارسال می‌شوند.
 */
@Component({
  selector: 'app-file-manager-header',
  standalone: true,
  template: `
    <header class="modal-header header">
      <div class="header__info">
        <div class="header__icon">
          <i class="fas fa-cloud-upload-alt"></i>
        </div>
        <div class="header__text">
          <h5 class="header__title">{{ title }}</h5>
          <p class="header__meta">
            {{ totalFiles }} فایل
            @if (isUploading) {
              <span> • {{ totalProgress }}% </span>
            }
            @if (readOnly) {
              <span class="badge bg-info ms-2">فقط مشاهده</span>
            }
          </p>
        </div>
      </div>

      <div class="header__actions">
        <div class="view-toggle">
          <button type="button" class="view-toggle__btn" [class.active]="viewMode === 'grid'"
                  (click)="viewModeChange.emit('grid')" title="نمایش شبکه‌ای">
            <i class="fas fa-th-large"></i>
          </button>
          <button type="button" class="view-toggle__btn" [class.active]="viewMode === 'list'"
                  (click)="viewModeChange.emit('list')" title="نمایش لیستی">
            <i class="fas fa-list"></i>
          </button>
        </div>

        @if (canUpload && !readOnly) {
          <button type="button" class="btn btn--secondary btn--icon"
                  (click)="addFiles.emit()"
                  [disabled]="disabled || !canAddMore"
                  title="افزودن فایل">
            <i class="fas fa-plus"></i>
            <span>افزودن</span>
          </button>
        }

        <button type="button" class="btn btn--ghost btn--close" (click)="closeRequested.emit()" title="بستن">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }

    .header {
      background: linear-gradient(135deg, var(--fm-primary) 0%, var(--fm-primary-dark) 100%);
      border-bottom: 2px solid var(--fm-accent);
      padding: 1rem 1.25rem;
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    }
    .header__info { display: flex; align-items: center; gap: 0.875rem; }
    .header__icon {
      width: 48px; height: 48px; border-radius: var(--fm-radius-lg);
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: grid; place-items: center;
      font-size: 1.25rem; color: var(--fm-accent);
    }
    .header__title { margin: 0; font-size: 1.125rem; font-weight: 700; color: #fff; }
    .header__meta { margin: 0.125rem 0 0; font-size: 0.8125rem; color: rgba(255, 255, 255, 0.8); display: flex; align-items: center; }
    .header__actions { display: flex; align-items: center; gap: 0.625rem; }

    .view-toggle { display: flex; background: rgba(255, 255, 255, 0.1); border-radius: var(--fm-radius); padding: 3px; }
    .view-toggle__btn {
      width: 34px; height: 34px; border: none; background: transparent;
      border-radius: var(--fm-radius-sm); color: rgba(255, 255, 255, 0.7);
      cursor: pointer; transition: var(--fm-transition); display: grid; place-items: center;
    }
    .view-toggle__btn:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
    .view-toggle__btn.active { background: var(--fm-accent); color: var(--fm-primary-dark); }

    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 0.5rem 1rem; border: none; border-radius: var(--fm-radius);
      font-family: inherit; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: var(--fm-transition);
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn--secondary { background: rgba(255, 255, 255, 0.15); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); }
    .btn--secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.25); }
    .btn--ghost { background: transparent; color: rgba(255, 255, 255, 0.8); padding: 0.5rem; }
    .btn--ghost:hover:not(:disabled) { color: #fff; background: rgba(255, 255, 255, 0.1); }
    .btn--close { width: 36px; height: 36px; border-radius: var(--fm-radius); }
    .btn--icon i { font-size: 0.8125rem; }

    @media (max-width: 768px) {
      .header { flex-wrap: wrap; }
      .header__actions { width: 100%; justify-content: flex-end; }
    }
  `],
})
export class FileManagerHeaderComponent {
  @Input() title = '';
  @Input() totalFiles = 0;
  @Input() isUploading = false;
  @Input() totalProgress = 0;
  @Input() readOnly = false;
  @Input() canUpload = true;
  @Input() disabled = false;
  @Input() canAddMore = true;
  @Input() viewMode: ViewMode = 'grid';

  @Output() viewModeChange = new EventEmitter<ViewMode>();
  @Output() addFiles = new EventEmitter<void>();
  @Output() closeRequested = new EventEmitter<void>();
}
