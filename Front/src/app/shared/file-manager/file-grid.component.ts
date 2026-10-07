import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import {
  TusUploadService,
  UploadStatus,
  FileItem,
} from '../../services/framework-services/tus-upload.service';
import { FileKind } from './file-manager.models';
import { formatSize, formatSpeed, getFileKind, thumbnailUrl } from './file-manager.utils';

/**
 * نمایش شبکه‌ای (کارت) فایل‌ها. کاملاً نمایشی است؛ همه اقدام‌ها به والد ارسال می‌شوند
 * و والد مسئول بررسی مجوزها (readOnly/canDelete) نیز هست.
 */
@Component({
  selector: 'app-file-grid',
  standalone: true,
  template: `
    <div class="file-grid">
      @for (file of files; track file.id) {
        <article class="file-card"
                 [class.file-card--selected]="selectedId === file.id"
                 [class.file-card--uploading]="file.status === Status.InProgress"
                 [class.file-card--completed]="file.status === Status.Completed"
                 [class.file-card--failed]="file.status === Status.Failed"
                 (click)="selectFile.emit(file.id)">

          <div class="file-card__thumb">
            @switch (getFileType(file)) {
              @case ('image') {
                <img [src]="thumb(file.previewUrl)" alt="" class="file-card__image"
                     loading="lazy" decoding="async" (load)="$any($event.target).classList.add('is-loaded')" />
              }
              @case ('pdf') {
                <div class="file-card__icon file-card__icon--pdf"><i class="fas fa-file-pdf"></i></div>
              }
              @case ('video') {
                <div class="file-card__icon file-card__icon--video"><i class="fas fa-play-circle"></i></div>
              }
              @case ('audio') {
                <div class="file-card__icon file-card__icon--audio"><i class="fas fa-headphones"></i></div>
              }
              @case ('text') {
                <div class="file-card__icon file-card__icon--text"><i class="fas fa-file-alt"></i></div>
              }
              @default {
                <div class="file-card__icon file-card__icon--generic"><i class="fas fa-file"></i></div>
              }
            }

            <button type="button" class="file-card__preview-btn"
                    (click)="onPreview(file.id, $event)" title="پیش‌نمایش">
              <i class="fas fa-expand"></i>
            </button>

            @if (file.status === Status.InProgress) {
              <div class="file-card__progress">
                <svg viewBox="0 0 36 36" class="progress-ring">
                  <circle class="progress-ring__bg" cx="18" cy="18" r="15.5"></circle>
                  <circle class="progress-ring__fill" cx="18" cy="18" r="15.5"
                          [style.strokeDashoffset]="97.5 - (97.5 * file.progress) / 100"></circle>
                </svg>
                <span class="progress-text">{{ file.progress }}%</span>
              </div>
            }

            @if (file.status === Status.Completed) {
              <div class="file-card__status">
                <i class="fas fa-check"></i>
              </div>
            }
            @if (file.status === Status.Failed) {
              <div class="file-card__status file-card__status--error">
                <i class="fas fa-exclamation"></i>
              </div>
            }
          </div>

          <div class="file-card__meta">
            <p class="file-card__name" [title]="file.name">{{ file.name }}</p>
            <p class="file-card__size">
              {{ formatSize(file.size) }}
              @if (file.status === Status.InProgress && file.speed > 0) {
                <span> • {{ formatSpeed(file.speed) }}</span>
              }
            </p>
            @if (file.errorMessage) {
              <p class="file-card__error">{{ file.errorMessage }}</p>
            }
          </div>

          <div class="file-card__actions" (click)="$event.stopPropagation()">
            <!-- Pause - فقط در حالت آپلود -->
            @if (file.status === Status.InProgress && !readOnly) {
              <button type="button" class="action-btn"
                      (click)="pauseUpload.emit(file.id)" title="توقف">
                <i class="fas fa-pause"></i>
              </button>
            }

            <!-- Resume - فقط در حالت آپلود -->
            @if (file.status === Status.Paused && !readOnly) {
              <button type="button" class="action-btn"
                      (click)="resumeUpload.emit(file.id)" title="ادامه">
                <i class="fas fa-play"></i>
              </button>
            }

            <!-- حذف فایل pending/failed - فقط وقتی canDelete فعال باشه -->
            @if ((file.status === Status.Pending || file.status === Status.Failed) && canDelete && !readOnly) {
              <button type="button" class="action-btn action-btn--danger"
                      (click)="removeFile.emit(file.id)" title="حذف">
                <i class="fas fa-trash-alt"></i>
              </button>
            }

            <!-- دانلود - همیشه فعال -->
            @if (file.status === Status.Completed && file.fileGuid) {
              <button type="button" class="action-btn"
                      (click)="downloadFile.emit(file)" title="دانلود">
                <i class="fas fa-download"></i>
              </button>
            }

            <!-- حذف از سرور - فقط وقتی canDelete فعال باشه -->
            @if (canDelete && !readOnly && file.status === Status.Completed && file.fileGuid) {
              <button type="button" class="action-btn action-btn--danger"
                      (click)="deleteFile.emit(file)" title="حذف از سرور">
                <i class="fas fa-trash-alt"></i>
              </button>
            }
          </div>
        </article>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
    .file-card {
      background: var(--fm-surface); border: 1px solid var(--fm-border);
      border-radius: var(--fm-radius-lg); overflow: hidden;
      cursor: pointer; transition: var(--fm-transition);
      box-shadow: var(--fm-shadow-sm);
    }
    .file-card:hover { transform: translateY(-2px); box-shadow: var(--fm-shadow); border-color: var(--fm-border-light); }
    .file-card--selected { border-color: var(--fm-accent); box-shadow: 0 0 0 3px rgba(240, 189, 5, 0.15); }
    .file-card--uploading { border-color: var(--fm-primary-light); }
    .file-card--completed { border-color: var(--fm-success); }
    .file-card--failed { border-color: var(--fm-danger); }

    .file-card__thumb {
      position: relative; height: 140px;
      background: linear-gradient(135deg, var(--fm-bg) 0%, var(--fm-surface) 100%);
      display: grid; place-items: center; overflow: hidden;
    }
    .file-card__image { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .25s ease; }
    .file-card__image.is-loaded { opacity: 1; }
    .file-card__icon { font-size: 2.5rem; opacity: 0.8; }
    .file-card__icon--pdf { color: #ef4444; }
    .file-card__icon--video { color: #8b5cf6; }
    .file-card__icon--audio { color: #f59e0b; }
    .file-card__icon--text { color: var(--fm-primary); }
    .file-card__icon--generic { color: var(--fm-text-muted); }

    .file-card__preview-btn {
      position: absolute; top: 0.625rem; left: 0.625rem;
      width: 32px; height: 32px; border: none;
      border-radius: var(--fm-radius);
      background: rgba(255, 255, 255, 0.95);
      color: var(--fm-text); cursor: pointer;
      display: grid; place-items: center;
      opacity: 0; transform: scale(0.9);
      transition: var(--fm-transition);
      box-shadow: var(--fm-shadow-sm);
    }
    .file-card:hover .file-card__preview-btn { opacity: 1; transform: scale(1); }
    .file-card__preview-btn:hover { background: var(--fm-accent); color: var(--fm-primary-dark); }

    .file-card__progress {
      position: absolute; bottom: 0.625rem; right: 0.625rem;
      width: 44px; height: 44px; display: grid; place-items: center;
    }
    .progress-ring { position: absolute; inset: 0; transform: rotate(-90deg); }
    .progress-ring__bg { fill: none; stroke: rgba(255, 255, 255, 0.3); stroke-width: 3; }
    .progress-ring__fill {
      fill: none; stroke: var(--fm-accent); stroke-width: 3; stroke-linecap: round;
      stroke-dasharray: 97.5; transition: stroke-dashoffset 0.3s ease;
    }
    .progress-text {
      font-size: 0.625rem; font-weight: 700; color: var(--fm-text);
      background: rgba(255, 255, 255, 0.9); padding: 2px 5px; border-radius: 4px;
    }

    .file-card__status {
      position: absolute; top: 0.625rem; right: 0.625rem;
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--fm-success); color: #fff;
      display: grid; place-items: center; font-size: 0.75rem;
      animation: popIn 0.3s ease;
    }
    .file-card__status--error { background: var(--fm-danger); }
    @keyframes popIn { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }

    .file-card__meta { padding: 0.75rem; }
    .file-card__name {
      margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--fm-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .file-card__size { margin: 0.25rem 0 0; font-size: 0.75rem; color: var(--fm-text-secondary); }
    .file-card__error { margin: 0.375rem 0 0; font-size: 0.75rem; color: var(--fm-danger); }

    .file-card__actions { display: flex; gap: 0.375rem; padding: 0 0.75rem 0.75rem; flex-wrap: wrap; }

    .action-btn {
      width: 32px; height: 32px; border: 1px solid var(--fm-border);
      border-radius: var(--fm-radius-sm); background: var(--fm-surface);
      color: var(--fm-text-secondary); cursor: pointer;
      display: grid; place-items: center; font-size: 0.75rem;
      transition: var(--fm-transition);
    }
    .action-btn:hover { border-color: var(--fm-primary); color: var(--fm-primary); background: rgba(13, 71, 161, 0.05); }
    .action-btn--danger:hover { border-color: var(--fm-danger); color: var(--fm-danger); background: rgba(211, 47, 47, 0.05); }

    @media (max-width: 768px) {
      .file-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
    }
  `],
})
export class FileGridComponent {
  /** بندانگشتی ۳۲۰ پیکسلی (دو برابر عرض کارت برای نمایشگرهای HiDPI) به جای تصویر اصلی */
  readonly thumb = (url?: string) => thumbnailUrl(url, 320);

  private readonly service = inject(TusUploadService);
  readonly Status = UploadStatus;

  @Input() files: FileItem[] = [];
  @Input() selectedId: string | null = null;
  @Input() readOnly = false;
  @Input() canDelete = true;

  @Output() selectFile = new EventEmitter<string>();
  @Output() previewFile = new EventEmitter<string>();
  @Output() pauseUpload = new EventEmitter<string>();
  @Output() resumeUpload = new EventEmitter<string>();
  @Output() removeFile = new EventEmitter<string>();
  @Output() downloadFile = new EventEmitter<FileItem>();
  @Output() deleteFile = new EventEmitter<FileItem>();

  readonly formatSize = formatSize;
  readonly formatSpeed = formatSpeed;

  getFileType(file: FileItem): FileKind {
    return getFileKind(file, this.service);
  }

  onPreview(id: string, event: Event): void {
    event.stopPropagation();
    this.previewFile.emit(id);
  }
}
