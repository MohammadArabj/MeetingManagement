import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { NgClass } from '@angular/common';

import {
  TusUploadService,
  UploadStatus,
  FileItem,
} from '../../services/framework-services/tus-upload.service';
import {
  formatSize,
  getFileIconClass,
  getFileKind,
  getStatusClass,
  getStatusText,
} from './file-manager.utils';

/**
 * نمایش لیستی (جدولی) فایل‌ها. کاملاً نمایشی است؛ همه اقدام‌ها به والد ارسال می‌شوند
 * و والد مسئول بررسی مجوزها (readOnly/canDelete) نیز هست.
 */
@Component({
  selector: 'app-file-table',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="file-table-wrapper">
      <table class="file-table">
        <thead>
          <tr>
            <th>نام فایل</th>
            <th class="col-size">حجم</th>
            <th class="col-status">وضعیت</th>
            <th class="col-actions">عملیات</th>
          </tr>
        </thead>
        <tbody>
          @for (file of files; track file.id) {
            <tr [class.row--selected]="selectedId === file.id" (click)="selectFile.emit(file.id)">
              <td>
                <div class="file-name-cell">
                  <i class="fas" [ngClass]="getFileIconClass(file)"></i>
                  <span>{{ file.name }}</span>
                </div>
              </td>
              <td>{{ formatSize(file.size) }}</td>
              <td>
                <span class="status-badge" [ngClass]="getStatusClass(file.status)">
                  {{ getStatusText(file.status, file.progress) }}
                </span>
              </td>
              <td (click)="$event.stopPropagation()">
                <div class="table-actions">
                  <button type="button" class="action-btn"
                          (click)="onPreview(file.id, $event)" title="پیش‌نمایش">
                    <i class="fas fa-eye"></i>
                  </button>

                  @if (file.status === Status.Completed && file.fileGuid) {
                    <button type="button" class="action-btn"
                            (click)="downloadFile.emit(file)" title="دانلود">
                      <i class="fas fa-download"></i>
                    </button>
                  }

                  @if (file.status !== Status.Completed && canDelete && !readOnly) {
                    <button type="button" class="action-btn action-btn--danger"
                            (click)="removeFile.emit(file.id)" title="حذف">
                      <i class="fas fa-times"></i>
                    </button>
                  }

                  @if (canDelete && !readOnly && file.status === Status.Completed && file.fileGuid) {
                    <button type="button" class="action-btn action-btn--danger"
                            (click)="deleteFile.emit(file)" title="حذف از سرور">
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .file-table-wrapper {
      background: var(--fm-surface); border-radius: var(--fm-radius-lg);
      overflow: hidden; box-shadow: var(--fm-shadow-sm); border: 1px solid var(--fm-border);
    }
    .file-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .file-table th {
      background: var(--fm-bg); padding: 0.75rem 1rem; text-align: right;
      font-weight: 600; color: var(--fm-text-secondary); border-bottom: 1px solid var(--fm-border);
    }
    .file-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--fm-border-light); color: var(--fm-text); }
    .file-table tbody tr { cursor: pointer; transition: var(--fm-transition); }
    .file-table tbody tr:hover { background: var(--fm-surface-hover); }
    .file-table tbody tr.row--selected { background: rgba(240, 189, 5, 0.08); }
    .file-table tbody tr:last-child td { border-bottom: none; }

    .col-size { width: 100px; }
    .col-status { width: 100px; }
    .col-actions { width: 160px; }

    .file-name-cell { display: flex; align-items: center; gap: 0.625rem; }
    .file-name-cell i { color: var(--fm-text-muted); }

    .status-badge { display: inline-block; padding: 0.25rem 0.625rem; border-radius: 999px; font-size: 0.75rem; font-weight: 500; }
    .status-badge--pending { background: rgba(100,116,139,0.1); color: var(--fm-text-secondary); }
    .status-badge--uploading { background: rgba(13,71,161,0.1); color: var(--fm-primary); }
    .status-badge--completed { background: rgba(46,125,50,0.1); color: var(--fm-success); }
    .status-badge--failed { background: rgba(211,47,47,0.1); color: var(--fm-danger); }
    .status-badge--paused { background: rgba(237,108,2,0.1); color: var(--fm-warning); }

    .table-actions { display: flex; gap: 0.375rem; }

    .action-btn {
      width: 32px; height: 32px; border: 1px solid var(--fm-border);
      border-radius: var(--fm-radius-sm); background: var(--fm-surface);
      color: var(--fm-text-secondary); cursor: pointer;
      display: grid; place-items: center; font-size: 0.75rem;
      transition: var(--fm-transition);
    }
    .action-btn:hover { border-color: var(--fm-primary); color: var(--fm-primary); background: rgba(13, 71, 161, 0.05); }
    .action-btn--danger:hover { border-color: var(--fm-danger); color: var(--fm-danger); background: rgba(211, 47, 47, 0.05); }
  `],
})
export class FileTableComponent {
  private readonly service = inject(TusUploadService);
  readonly Status = UploadStatus;

  @Input() files: FileItem[] = [];
  @Input() selectedId: string | null = null;
  @Input() readOnly = false;
  @Input() canDelete = true;

  @Output() selectFile = new EventEmitter<string>();
  @Output() previewFile = new EventEmitter<string>();
  @Output() removeFile = new EventEmitter<string>();
  @Output() downloadFile = new EventEmitter<FileItem>();
  @Output() deleteFile = new EventEmitter<FileItem>();

  readonly formatSize = formatSize;
  readonly getStatusClass = getStatusClass;
  readonly getStatusText = getStatusText;

  getFileIconClass(file: FileItem): string {
    return getFileIconClass(getFileKind(file, this.service));
  }

  onPreview(id: string, event: Event): void {
    event.stopPropagation();
    this.previewFile.emit(id);
  }
}
