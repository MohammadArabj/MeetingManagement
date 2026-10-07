import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  HostListener,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import {
  TusUploadService,
  UploadStatus,
  FileItem,
  BulkDeleteAttachmentsResult
} from '../../services/framework-services/tus-upload.service';
import { AppSettings } from '../../services/system-setting.service';

declare const Swal: any;
declare const bootstrap: any;

type ViewMode = 'grid' | 'list';

interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
  isDragging: boolean;
  startX: number;
  startY: number;
}

@Component({
  selector: 'app-file-manager-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
   <div class="modal fade file-manager" [id]="modalId" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-xl modal-fullscreen-lg-down">
        <div class="modal-content shell">

          <!-- HEADER -->
          <header class="modal-header header">
            <div class="header__info">
              <div class="header__icon">
                <i class="fas fa-cloud-upload-alt"></i>
              </div>
              <div class="header__text">
                <h5 class="header__title">{{ title }}</h5>
                <p class="header__meta">
                  {{ service.totalFiles() }} فایل
                  @if (service.isUploading()) {
                    <span> • {{ service.totalProgress() }}% </span>
                  }
                  @if (readOnly) {
                    <span class="badge bg-info ms-2">فقط مشاهده</span>
                  }
                </p>
              </div>
            </div>

            <div class="header__actions">
              <div class="view-toggle">
                <button type="button" class="view-toggle__btn" [class.active]="viewMode() === 'grid'"
                        (click)="viewMode.set('grid')" title="نمایش شبکه‌ای">
                  <i class="fas fa-th-large"></i>
                </button>
                <button type="button" class="view-toggle__btn" [class.active]="viewMode() === 'list'"
                        (click)="viewMode.set('list')" title="نمایش لیستی">
                  <i class="fas fa-list"></i>
                </button>
              </div>

              @if (canUpload && !readOnly) {
                <button type="button" class="btn btn--secondary btn--icon"
                        (click)="openFilePicker()"
                        [disabled]="disabled || !canAddMore()"
                        title="افزودن فایل">
                  <i class="fas fa-plus"></i>
                  <span>افزودن</span>
                </button>

                <!-- <button type="button" class="btn btn--primary btn--icon"
                        (click)="startUpload()"
                        [disabled]="disabled || service.pendingFiles().length === 0 || service.isUploading()"
                        title="شروع آپلود">
                  <i class="fas fa-upload"></i>
                  <span>آپلود</span>
                </button> -->
              }

              <button type="button" class="btn btn--ghost btn--close" (click)="requestClose()" title="بستن">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </header>

          <!-- BODY -->
          <div class="modal-body body">
            <div class="layout" [class.layout--preview-open]="showPreview()">

              <!-- LEFT PANEL -->
              <section class="panel-left"
                       [class.panel-left--dragging]="isDragOver()"
                       (dragover)="onDragOver($event)"
                       (dragleave)="onDragLeave($event)"
                       (drop)="onDrop($event)">

                <!-- در قسمت dropzone -->
@if (canUpload && !readOnly) {
  <div class="dropzone" (click)="openFilePicker()">
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
          حداکثر {{ effectiveMaxFileSizeMB() }} مگابایت
        </span>
        @if (multiple) {
          <span class="hint">
            <i class="fas fa-layer-group"></i>
            حداکثر {{ effectiveMaxFiles() }} فایل
          </span>
        }
      </div>

      <!-- ✅ نمایش فرمت‌های مجاز به صورت دسته‌بندی شده -->
      <div class="dropzone__formats">
        <p class="formats-title">
          <i class="fas fa-file-check"></i>
          فرمت‌های مجاز:
        </p>
        <div class="formats-grid">
          {{fileTypeCategories()}}
          <!-- @for (category of fileTypeCategories(); track category.category) {
            <div class="format-category">
              <i class="fas {{ category.icon }}"></i>
              <span class="category-name">{{ category.category }}:</span>
              <span class="category-exts">
                {{ category.extensions.join(', ').replace(/\./g, '') | uppercase }}
              </span>
            </div>
          } -->
        </div>
      </div>
    </div>
  </div>
}



                <!-- پیام حالت فقط مشاهده -->
                @if (readOnly) {
                  <div class="readonly-notice">
                    <div class="readonly-notice__icon">
                      <i class="fas fa-eye"></i>
                    </div>
                    <div class="readonly-notice__content">
                      <p class="readonly-notice__title">حالت مشاهده</p>
                      <p class="readonly-notice__subtitle">فقط امکان مشاهده و دانلود فایل‌ها وجود دارد</p>
                    </div>
                  </div>
                }

                @if (service.totalFiles() > 0) {
                  <div class="file-list">

                    <!-- GRID -->
                    @if (viewMode() === 'grid') {
                      <div class="file-grid">
                        @for (file of service.files(); track file.id) {
                          <article class="file-card"
                                   [class.file-card--selected]="selectedId() === file.id"
                                   [class.file-card--uploading]="file.status === Status.InProgress"
                                   [class.file-card--completed]="file.status === Status.Completed"
                                   [class.file-card--failed]="file.status === Status.Failed"
                                   (click)="select(file.id)">

                            <div class="file-card__thumb">
                              @switch (getFileType(file)) {
                                @case ('image') {
                                  <img [src]="file.previewUrl" alt="" class="file-card__image" />
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
                                      (click)="togglePreview(file.id, $event)" title="پیش‌نمایش">
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
                                        (click)="pause(file.id)" title="توقف">
                                  <i class="fas fa-pause"></i>
                                </button>
                              }

                              <!-- Resume - فقط در حالت آپلود -->
                              @if (file.status === Status.Paused && !readOnly) {
                                <button type="button" class="action-btn"
                                        (click)="resume(file.id)" title="ادامه">
                                  <i class="fas fa-play"></i>
                                </button>
                              }

                              <!-- حذف فایل pending/failed - فقط وقتی canDelete فعال باشه -->
                              @if ((file.status === Status.Pending || file.status === Status.Failed) && canDelete && !readOnly) {
                                <button type="button" class="action-btn action-btn--danger"
                                        (click)="remove(file.id)" title="حذف">
                                  <i class="fas fa-trash-alt"></i>
                                </button>
                              }

                              <!-- دانلود - همیشه فعال -->
                              @if (file.status === Status.Completed && file.fileGuid) {
                                <button type="button" class="action-btn"
                                        (click)="download(file)" title="دانلود">
                                  <i class="fas fa-download"></i>
                                </button>
                              }

                              <!-- حذف از سرور - فقط وقتی canDelete فعال باشه -->
                              @if (canDelete && !readOnly && file.status === Status.Completed && file.fileGuid) {
                                <button type="button" class="action-btn action-btn--danger"
                                        (click)="deleteFromServer(file)" title="حذف از سرور">
                                  <i class="fas fa-trash-alt"></i>
                                </button>
                              }
                            </div>
                          </article>
                        }
                      </div>
                    }

                    <!-- LIST -->
                    @if (viewMode() === 'list') {
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
                            @for (file of service.files(); track file.id) {
                              <tr [class.row--selected]="selectedId() === file.id" (click)="select(file.id)">
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
                                            (click)="togglePreview(file.id, $event)" title="پیش‌نمایش">
                                      <i class="fas fa-eye"></i>
                                    </button>

                                    @if (file.status === Status.Completed && file.fileGuid) {
                                      <button type="button" class="action-btn"
                                              (click)="download(file)" title="دانلود">
                                        <i class="fas fa-download"></i>
                                      </button>
                                    }

                                    @if (file.status !== Status.Completed && canDelete && !readOnly) {
                                      <button type="button" class="action-btn action-btn--danger"
                                              (click)="remove(file.id)" title="حذف">
                                        <i class="fas fa-times"></i>
                                      </button>
                                    }

                                    @if (canDelete && !readOnly && file.status === Status.Completed && file.fileGuid) {
                                      <button type="button" class="action-btn action-btn--danger"
                                              (click)="deleteFromServer(file)" title="حذف از سرور">
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
                    }

                  </div>
                } @else if (readOnly) {
                  <!-- پیام خالی بودن در حالت فقط مشاهده -->
                  <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>هیچ فایلی وجود ندارد</p>
                  </div>
                }

                <!-- ✅ آپدیت input -->
<input #fileInput type="file"
       [multiple]="multiple"
       [accept]="effectiveAcceptedTypes()"
       (change)="onFilesSelected($event)"
       hidden />
              </section>

              <!-- RIGHT PANEL: PREVIEW -->
              @if (showPreview() && selectedFile(); as file) {
                <aside class="panel-right"
                       [class.panel-right--fullscreen]="isFullscreen()">

                  <header class="preview-header">
                    <div class="preview-header__info">
                      <i class="fas fa-eye"></i>
                      <span>پیش‌نمایش</span>
                    </div>

                    @if (getFileType(file) === 'image') {
                      <div class="zoom-controls">
                        <button type="button" class="zoom-btn" (click)="zoomOut()" title="کوچک‌نمایی"
                                [disabled]="zoomState().scale <= MIN_ZOOM">
                          <i class="fas fa-search-minus"></i>
                        </button>
                        <span class="zoom-level">{{ (zoomState().scale * 100).toFixed(0) }}%</span>
                        <button type="button" class="zoom-btn" (click)="zoomIn()" title="بزرگ‌نمایی"
                                [disabled]="zoomState().scale >= MAX_ZOOM">
                          <i class="fas fa-search-plus"></i>
                        </button>
                        <div class="zoom-divider"></div>
                        <button type="button" class="zoom-btn" (click)="zoomFit()" title="تناسب با صفحه">
                          <i class="fas fa-expand-arrows-alt"></i>
                        </button>
                        <button type="button" class="zoom-btn" (click)="zoomActual()" title="اندازه واقعی">
                          <i class="fas fa-compress-arrows-alt"></i>
                        </button>
                      </div>
                    }

                    <div class="preview-header__actions">
                      <button type="button" class="action-btn"
                              (click)="openPreviewInNewTab()"
                              [disabled]="!previewOpenable()"
                              title="باز کردن در تب جدید">
                        <i class="fas fa-external-link-alt"></i>
                      </button>

                      <button type="button" class="action-btn"
                              (click)="toggleFullscreen()" title="تمام صفحه">
                        <i class="fas" [ngClass]="isFullscreen() ? 'fa-compress' : 'fa-expand'"></i>
                      </button>

                      <button type="button" class="action-btn action-btn--danger"
                              (click)="closePreview()" title="بستن">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                  </header>

                  <div class="preview-body" #previewHost (wheel)="onPreviewWheel($event)">
                    @switch (getFileType(file)) {

                      @case ('image') {
                        <div class="image-preview"
                             [class.image-preview--grabbing]="zoomState().isDragging"
                             (mousedown)="onImageMouseDown($event)"
                             (mousemove)="onImageMouseMove($event)"
                             (mouseup)="onImageMouseUp()"
                             (mouseleave)="onImageMouseUp()">
                          <img #previewImage
                               [src]="file.previewUrl"
                               alt=""
                               class="preview-image"
                               [style.transform]="getImageTransform()"
                               draggable="false" />
                        </div>
                      }

                      @case ('pdf') {
                        @if (selectedSafeUrl(); as safeUrl) {
                          <iframe class="preview-iframe" [src]="safeUrl"></iframe>
                        } @else {
                          <div class="preview-loading">
                            <i class="fas fa-spinner fa-spin fa-2x"></i>
                            <p>در حال بارگذاری...</p>
                          </div>
                        }
                      }

                      @case ('video') {
                        <video class="preview-video" [src]="file.previewUrl" controls></video>
                      }

                      @case ('audio') {
                        <div class="audio-preview">
                          <div class="audio-preview__visual">
                            <i class="fas fa-music"></i>
                            <div class="audio-preview__waves"><span></span><span></span><span></span><span></span><span></span></div>
                          </div>
                          <audio [src]="file.previewUrl" controls></audio>
                        </div>
                      }

                      @case ('text') {
                        <pre class="preview-text">{{ file.previewText || (file.isPreviewLoading ? 'در حال بارگذاری...' : 'متنی برای نمایش وجود ندارد') }}</pre>
                      }

                      @default {
                        <div class="preview-unavailable">
                          <i class="fas fa-file-download"></i>
                          <p>پیش‌نمایش برای این نوع فایل در دسترس نیست</p>
                          @if (file.fileGuid) {
                            <button type="button" class="btn btn--primary" (click)="download(file)">
                              <i class="fas fa-download"></i>
                              دانلود فایل
                            </button>
                          }
                        </div>
                      }
                    }
                  </div>

                  <footer class="preview-footer">
                    <div class="preview-footer__info">
                      <p class="preview-footer__name">{{ file.name }}</p>
                      <p class="preview-footer__meta">{{ formatSize(file.size) }}</p>
                    </div>
                    <div class="preview-footer__actions">
                      @if (file.fileGuid) {
                        <button type="button" class="btn btn--primary" (click)="download(file)">
                          <i class="fas fa-download"></i>
                          دانلود
                        </button>
                      }
                      @if (canDelete && !readOnly && file.fileGuid) {
                        <button type="button" class="btn btn--danger" (click)="deleteFromServer(file)">
                          <i class="fas fa-trash-alt"></i>
                          حذف
                        </button>
                      }
                    </div>
                  </footer>

                </aside>
              }

            </div>
          </div>

          <!-- FOOTER -->
          <footer class="modal-footer footer">
            <div class="footer__stats">
              <span class="stat">
                <i class="fas fa-file"></i>
                {{ service.totalFiles() }} فایل
              </span>
              <span class="stat stat--success">
                <i class="fas fa-check-circle"></i>
                {{ service.completedFiles().length }} کامل
              </span>
              @if (service.pendingFiles().length > 0) {
                <span class="stat stat--pending">
                  <i class="fas fa-clock"></i>
                  {{ service.pendingFiles().length }} در انتظار
                </span>
              }
            </div>

            <div class="footer__actions">
               @if (!readOnly) {
                <button type="button" class="btn btn--primary" (click)="onConfirm()" [disabled]="service.isUploading()">
                  تأیید
                </button>
              }
              <button type="button" class="btn btn--secondary" (click)="requestClose()">
                {{ readOnly ? 'بستن' : 'انصراف' }}
              </button>

             
            </div>
          </footer>

        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --fm-primary: #0d47a1;
      --fm-primary-light: #1565c0;
      --fm-primary-dark: #0a3d8f;

      --fm-accent: #f0bd05;
      --fm-accent-light: #ffd54f;
      --fm-accent-dark: #c9a000;

      --fm-success: #2e7d32;
      --fm-warning: #ed6c02;
      --fm-danger: #d32f2f;

      --fm-bg: #f5f7fa;
      --fm-surface: #ffffff;
      --fm-surface-hover: #fafbfc;

      --fm-text: #1a1a2e;
      --fm-text-secondary: #64748b;
      --fm-text-muted: #94a3b8;

      --fm-border: #e2e8f0;
      --fm-border-light: #f1f5f9;

      --fm-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --fm-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
        0 2px 4px -2px rgba(0, 0, 0, 0.1);
      --fm-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
        0 8px 10px -6px rgba(0, 0, 0, 0.1);

      --fm-radius-sm: 6px;
      --fm-radius: 10px;
      --fm-radius-lg: 14px;
      --fm-radius-xl: 20px;

      --fm-transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      direction: rtl;
      font-family: 'Vazirmatn', 'Sahel', Tahoma, sans-serif;
    }

    .shell { border-radius: var(--fm-radius-xl); overflow: hidden; border: none; box-shadow: var(--fm-shadow-xl); }

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

    .btn--primary { background: var(--fm-accent); color: var(--fm-primary-dark); }
    .btn--primary:hover:not(:disabled) { background: var(--fm-accent-light); transform: translateY(-1px); box-shadow: var(--fm-shadow); }
    .btn--secondary { background: rgba(255, 255, 255, 0.15); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); }
    .btn--secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.25); }
    .btn--danger { background: var(--fm-danger); color: #fff; }
    .btn--danger:hover:not(:disabled) { background: #c62828; }

    .btn--ghost { background: transparent; color: rgba(255, 255, 255, 0.8); padding: 0.5rem; }
    .btn--ghost:hover:not(:disabled) { color: #fff; background: rgba(255, 255, 255, 0.1); }
    .btn--close { width: 36px; height: 36px; border-radius: var(--fm-radius); }
    .btn--icon i { font-size: 0.8125rem; }

    .body { padding: 0; background: var(--fm-bg); }
    .layout { display: grid; grid-template-columns: 1fr; min-height: 520px; }
    .layout--preview-open { grid-template-columns: 1fr 440px; }

    .panel-left { padding: 1.25rem; overflow-y: auto; overflow-x: hidden; transition: var(--fm-transition); }
    .panel-left--dragging {
      background: linear-gradient(135deg, rgba(240, 189, 5, 0.08) 0%, rgba(240, 189, 5, 0.04) 100%);
      outline: 2px dashed var(--fm-accent); outline-offset: -8px;
    }

    .dropzone {
      background: var(--fm-surface); border: 2px dashed var(--fm-border);
      border-radius: var(--fm-radius-lg); padding: 1.5rem;
      display: flex; align-items: center; gap: 1.25rem;
      cursor: pointer; transition: var(--fm-transition); margin-bottom: 1.25rem;
    }
    .dropzone:hover { border-color: var(--fm-accent); background: var(--fm-surface-hover); }
    .panel-left--dragging .dropzone { border-color: var(--fm-accent); background: rgba(240, 189, 5, 0.08); }

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

    /* Read-only Notice */
    .readonly-notice {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border: 2px solid #90caf9;
      border-radius: var(--fm-radius-lg); padding: 1.5rem;
      display: flex; align-items: center; gap: 1.25rem;
      margin-bottom: 1.25rem;
    }
    .readonly-notice__icon {
      width: 64px; height: 64px; flex-shrink: 0;
      display: grid; place-items: center;
      background: rgba(33, 150, 243, 0.15);
      border-radius: var(--fm-radius-lg); font-size: 1.5rem; color: #1976d2;
    }
    .readonly-notice__title { margin: 0; font-size: 1rem; font-weight: 700; color: #1565c0; }
    .readonly-notice__subtitle { margin: 0.25rem 0 0; font-size: 0.8125rem; color: #42a5f5; }

    /* Empty State */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 3rem; color: var(--fm-text-muted); text-align: center;
      background: var(--fm-surface); border-radius: var(--fm-radius-lg);
      border: 1px dashed var(--fm-border);
    }
    .empty-state i { font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; }
    .empty-state p { margin: 0; font-size: 1rem; }

    /* Preview Loading */
    .preview-loading {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; color: var(--fm-text-secondary);
    }
    .preview-loading i { margin-bottom: 1rem; color: var(--fm-primary); }
    .preview-loading p { margin: 0; }

    .file-list { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

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
    .file-card__image { width: 100%; height: 100%; object-fit: cover; }
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

    .panel-right {
      background: var(--fm-surface); border-right: 1px solid var(--fm-border);
      display: flex; flex-direction: column; animation: slideIn 0.3s ease;
    }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
    .panel-right--fullscreen { position: fixed; inset: 0; z-index: 9999; border: none; animation: none; }

    .preview-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.75rem 1rem;
      background: linear-gradient(135deg, rgba(240,189,5,0.08) 0%, rgba(240,189,5,0.04) 100%);
      border-bottom: 1px solid var(--fm-border);
      border-right: 3px solid var(--fm-accent);
      gap: 0.75rem; flex-wrap: wrap;
    }
    .preview-header__info { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 600; color: var(--fm-text); }
    .preview-header__info i { color: var(--fm-accent-dark); }
    .preview-header__actions { display: flex; gap: 0.375rem; }

    .zoom-controls {
      display: flex; align-items: center; gap: 0.375rem;
      background: var(--fm-surface); border: 1px solid var(--fm-border);
      border-radius: var(--fm-radius); padding: 0.25rem;
    }
    .zoom-btn {
      width: 28px; height: 28px; border: none; border-radius: var(--fm-radius-sm);
      background: transparent; color: var(--fm-text-secondary);
      cursor: pointer; display: grid; place-items: center; font-size: 0.75rem;
      transition: var(--fm-transition);
    }
    .zoom-btn:hover:not(:disabled) { background: var(--fm-bg); color: var(--fm-text); }
    .zoom-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .zoom-level { min-width: 48px; text-align: center; font-size: 0.75rem; font-weight: 600; color: var(--fm-text); }
    .zoom-divider { width: 1px; height: 20px; background: var(--fm-border); margin: 0 0.25rem; }

    .preview-body {
      flex: 1; overflow: hidden; background: var(--fm-bg);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    }

    .image-preview {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      cursor: grab; overflow: hidden;
      background: repeating-conic-gradient(var(--fm-border-light) 0% 25%, var(--fm-surface) 0% 50%) 50% / 20px 20px;
      border-radius: var(--fm-radius);
    }
    .image-preview--grabbing { cursor: grabbing; }
    .preview-image { max-width: none; max-height: none; transition: transform 0.1s ease-out; user-select: none; pointer-events: none; }

    .preview-iframe { width: 100%; height: 100%; border: none; border-radius: var(--fm-radius); background: var(--fm-surface); }
    .preview-video { max-width: 100%; max-height: 100%; border-radius: var(--fm-radius); background: #000; }

    .audio-preview {
      width: 100%; max-width: 400px; background: var(--fm-surface);
      border-radius: var(--fm-radius-lg); padding: 2rem;
      text-align: center; box-shadow: var(--fm-shadow);
    }
    .audio-preview__visual { margin-bottom: 1.5rem; }
    .audio-preview__visual i { font-size: 3rem; color: var(--fm-accent); margin-bottom: 1rem; display: block; }
    .audio-preview__waves { display: flex; justify-content: center; gap: 4px; height: 32px; align-items: center; }
    .audio-preview__waves span { width: 4px; background: var(--fm-accent); border-radius: 2px; animation: wave 1.2s ease-in-out infinite; }
    .audio-preview__waves span:nth-child(1) { height: 12px; animation-delay: 0s; }
    .audio-preview__waves span:nth-child(2) { height: 24px; animation-delay: 0.1s; }
    .audio-preview__waves span:nth-child(3) { height: 32px; animation-delay: 0.2s; }
    .audio-preview__waves span:nth-child(4) { height: 24px; animation-delay: 0.3s; }
    .audio-preview__waves span:nth-child(5) { height: 12px; animation-delay: 0.4s; }
    @keyframes wave { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
    .audio-preview audio { width: 100%; }

    .preview-text {
      width: 100%; height: 100%;
      margin: 0; padding: 1rem; background: var(--fm-surface);
      border: 1px solid var(--fm-border); border-radius: var(--fm-radius);
      font-family: 'Fira Code', 'JetBrains Mono', ui-monospace, monospace;
      font-size: 0.875rem; line-height: 1.6; color: var(--fm-text);
      white-space: pre-wrap; overflow: auto;
    }

    .preview-unavailable { text-align: center; padding: 2rem; color: var(--fm-text-secondary); }
    .preview-unavailable i { font-size: 3rem; color: var(--fm-text-muted); margin-bottom: 1rem; }
    .preview-unavailable p { margin: 0 0 1.25rem; }

    .preview-footer {
      padding: 0.875rem 1rem; border-top: 1px solid var(--fm-border);
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      background: var(--fm-surface);
    }
    .preview-footer__name {
      margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--fm-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .preview-footer__meta { margin: 0.125rem 0 0; font-size: 0.75rem; color: var(--fm-text-secondary); }
    .preview-footer__actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

    .footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.875rem 1.25rem;
      background: var(--fm-surface); border-top: 1px solid var(--fm-border);
    }
    .footer__stats { display: flex; gap: 1rem; }
    .stat { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--fm-text-secondary); }
    .stat i { font-size: 0.75rem; }
    .stat--success { color: var(--fm-success); }
    .stat--pending { color: var(--fm-warning); }
    .footer__actions { display: flex; gap: 0.625rem; }
    .footer .btn--secondary { background: var(--fm-bg); color: var(--fm-text); border: 1px solid var(--fm-border); }
    .footer .btn--secondary:hover { background: var(--fm-border-light); }

    @media (max-width: 1200px) {
      .layout--preview-open { grid-template-columns: 1fr; }
      .panel-right { position: absolute; inset: 0; z-index: 10; border: none; }
    }
    @media (max-width: 768px) {
      .header { flex-wrap: wrap; }
      .header__actions { width: 100%; justify-content: flex-end; }
      .file-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
      .dropzone { flex-direction: column; text-align: center; }
      .zoom-controls { order: -1; width: 100%; justify-content: center; }
    }
    /* ═══════════════════════════════════════════════════════════ */
/* Formats Section */
/* ═══════════════════════════════════════════════════════════ */

.dropzone__formats {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--fm-border);
  width: 100%;
}

.formats-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--fm-text-secondary);
}

.formats-title i {
  color: var(--fm-accent-dark);
}

.formats-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.format-category {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: linear-gradient(135deg, rgba(240, 189, 5, 0.08) 0%, rgba(240, 189, 5, 0.04) 100%);
  border: 1px solid rgba(240, 189, 5, 0.2);
  border-radius: 20px;
  font-size: 0.75rem;
  transition: var(--fm-transition);
}

.format-category:hover {
  background: rgba(240, 189, 5, 0.15);
  border-color: var(--fm-accent);
}

.format-category i {
  font-size: 0.875rem;
  color: var(--fm-accent-dark);
}

.category-name {
  font-weight: 600;
  color: var(--fm-text);
}

.category-exts {
  color: var(--fm-text-secondary);
  font-size: 0.6875rem;
}

/* ═══════════════════════════════════════════════════════════ */
/* نمایش ساده‌تر (فقط لیست فرمت‌ها) */
/* ═══════════════════════════════════════════════════════════ */

.formats-simple {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  justify-content: center;
  margin-top: 0.75rem;
}

.format-tag {
  display: inline-block;
  padding: 0.1875rem 0.5rem;
  background: var(--fm-bg);
  border: 1px solid var(--fm-border);
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--fm-text-muted);
  text-transform: uppercase;
}

/* ═══════════════════════════════════════════════════════════ */
/* Responsive */
/* ═══════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .formats-grid {
    flex-direction: column;
    align-items: stretch;
  }
  
  .format-category {
    justify-content: flex-start;
  }
}
  `],
})
export class FileManagerModalComponent implements OnInit, OnDestroy, OnChanges {
  // ═══════════════════════════════════════════════════════════
  // Inputs - تنظیمات اصلی
  // ═══════════════════════════════════════════════════════════
  @Input() modalId = 'fileManagerModal';
  @Input() title = 'مدیریت فایل';
  @Input() folderPath = '';
  @Input() existingFileGuids: string[] = [];
  @Input() multiple = true;
  @Input() maxFiles = 10;
  @Input() maxFileSizeMB = 100;
  @Input() acceptedTypes = '*';
  @Input() autoUpload = true;

  // ═══════════════════════════════════════════════════════════
  // Inputs - کنترل دسترسی‌ها ✅ جدید
  // ═══════════════════════════════════════════════════════════
  @Input() disabled = false;        // کلاً غیرفعال
  @Input() readOnly = false;        // فقط مشاهده (بدون هیچ تغییری)
  @Input() canUpload = true;        // امکان آپلود فایل جدید
  @Input() canDelete = true;        // امکان حذف فایل

  // Outputs
  @Output() confirmed = new EventEmitter<string[]>();
  @Output() cancelled = new EventEmitter<void>();

  // ViewChild
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('previewHost') previewHost?: ElementRef<HTMLElement>;

  // Services
  readonly service = inject(TusUploadService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly Status = UploadStatus;

  // UI State
  readonly viewMode = signal<ViewMode>('grid');
  readonly isDragOver = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly showPreview = signal(false);
  readonly isFullscreen = signal(false);
  readonly isOpen = signal(false);
  // ═══════════════════════════════════════════════════════════

  /**
   * حداکثر تعداد فایل - اگر Input داده نشده از AppSettings می‌خواند
   */
  readonly effectiveMaxFiles = computed(() => {
    return this.maxFiles ?? AppSettings.maxResolutionAttachments;
  });

  /**
   * حداکثر سایز فایل - اگر Input داده نشده از AppSettings می‌خواند
   */
  readonly effectiveMaxFileSizeMB = computed(() => {
    return this.maxFileSizeMB ?? AppSettings.maxAttachmentSizeMB;
  });

  /**
   * فرمت‌های مجاز - اگر Input داده نشده از AppSettings می‌خواند
   */
  readonly effectiveAcceptedTypes = computed(() => {
    return this.acceptedTypes ?? AppSettings.acceptedMimeTypes;
  });

  /**
   * فرمت‌های مجاز برای نمایش
   */
  readonly allowedExtensionsDisplay = computed(() => {
    if (this.acceptedTypes && this.acceptedTypes !== '*') {
      // اگر دستی تنظیم شده
      return this.acceptedTypes.split(',').map(t => t.trim().toUpperCase());
    }
    return AppSettings.allowedFileExtensionsDisplay;
  });

  /**
   * دسته‌بندی فرمت‌ها
   */
  readonly fileTypeCategories = computed(() => {
    return AppSettings.allowedFileExtensions;
  });

  // ═══════════════════════════════════════════════════════════
  // ✅ آپدیت canAddMore
  // ═══════════════════════════════════════════════════════════

  readonly canAddMore = computed(() => {
    if (!this.multiple && this.service.totalFiles() > 0) return false;
    const maxFiles = this.effectiveMaxFiles();
    if (maxFiles && this.service.totalFiles() >= maxFiles) return false;
    return true;
  });

  // ═══════════════════════════════════════════════════════════
  // ✅ آپدیت متدهای فایل
  // ═══════════════════════════════════════════════════════════

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const added = this.service.addFiles(input.files, {
      maxFiles: this.effectiveMaxFiles(),           // ✅ از computed
      maxSizeMB: this.effectiveMaxFileSizeMB(),     // ✅ از computed
      acceptedTypes: this.effectiveAcceptedTypes()  // ✅ از computed
        ? this.effectiveAcceptedTypes().split(',')
        : undefined,
      localPreview: true,
    });

    input.value = '';

    if (this.autoUpload && added.length) this.startUpload();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    if (this.disabled || this.readOnly || !this.canUpload) return;

    const files = event.dataTransfer?.files;
    if (!files?.length) return;

    const added = this.service.addFiles(files, {
      maxFiles: this.effectiveMaxFiles(),           // ✅ از computed
      maxSizeMB: this.effectiveMaxFileSizeMB(),     // ✅ از computed
      acceptedTypes: this.effectiveAcceptedTypes()  // ✅ از computed
        ? this.effectiveAcceptedTypes().split(',')
        : undefined,
      localPreview: true,
    });

    if (this.autoUpload && added.length) this.startUpload();
  }
  // Zoom
  readonly MIN_ZOOM = 0.25;
  readonly MAX_ZOOM = 5;
  private readonly ZOOM_STEP = 0.25;

  readonly zoomState = signal<ZoomState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
  });

  // Safe URL Cache
  private readonly safeUrlCache = new Map<string, SafeResourceUrl>();

  private modalInstance: any;
  private modalEl?: HTMLElement;
  private modalHandlersRegistered = false;
  private allowHideOnce = false;
  private promptingClose = false;

  private baselineGuids = new Set<string>();
  private normGuid(g: string): string { return (g || '').trim().toLowerCase(); }

  // ═══════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════

  readonly selectedFile = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.service.filesMap().get(id) ?? null;
  });

  readonly selectedSafeUrl = computed(() => {
    const file = this.selectedFile();
    if (!file) return null;

    const rawUrl = file.previewUrl;
    if (!rawUrl) return null;

    // چک کش
    const cached = this.safeUrlCache.get(rawUrl);
    if (cached) return cached;

    // ساخت URL امن
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
    this.safeUrlCache.set(rawUrl, safeUrl);

    return safeUrl;
  });

  // ═══════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════

  async ngOnInit(): Promise<void> {
    this.resetState();
    this.captureBaseline();
    document.addEventListener('fullscreenchange', this.onFullscreenChange, { passive: true });
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.modalInstance?.dispose();
    this.safeUrlCache.clear();
  }

  // ✅ تشخیص تغییرات Input
  ngOnChanges(changes: SimpleChanges): void {
    // اگه existingFileGuids تغییر کرد و modal باز نیست، کاری نکن
    // فقط وقتی open() صدا زده میشه فایل‌ها لود میشن
  }

  // ═══════════════════════════════════════════════════════════
  // Modal Operations
  // ═══════════════════════════════════════════════════════════

  private registerModalEvents(el: HTMLElement): void {
    if (this.modalHandlersRegistered) return;
    this.modalEl = el;

    el.addEventListener('shown.bs.modal', () => this.isOpen.set(true));
    el.addEventListener('hidden.bs.modal', () => {
      this.isOpen.set(false);
      this.allowHideOnce = false;
      this.promptingClose = false;
    });

    el.addEventListener('hide.bs.modal', (ev: any) => {
      if (this.allowHideOnce) return;

      ev?.preventDefault?.();

      if (this.promptingClose) return;
      this.promptingClose = true;

      Promise.resolve()
        .then(async () => {
          // در حالت readOnly مستقیم ببند
          if (this.readOnly) {
            await this.closeWithoutSave();
          } else if (this.hasUnsavedChanges()) {
            await this.requestClose();
          } else {
            await this.closeWithoutSave();
          }
        })
        .finally(() => (this.promptingClose = false));
    });

    this.modalHandlersRegistered = true;
  }

  private ensureModalInstance(): void {
    const el = document.getElementById(this.modalId) as HTMLElement | null;
    if (!el) return;

    this.registerModalEvents(el);

    if (!this.modalInstance) {
      const maybeGet = (bootstrap as any)?.Modal?.getOrCreateInstance;
      if (typeof maybeGet === 'function') {
        this.modalInstance = (bootstrap as any).Modal.getOrCreateInstance(el, { backdrop: 'static', keyboard: false });
      } else {
        this.modalInstance = new (bootstrap as any).Modal(el, { backdrop: 'static', keyboard: false });
      }
    }
  }

  private hideModal(): void {
    this.ensureModalInstance();
    this.allowHideOnce = true;
    this.modalInstance?.hide();
  }

  // ✅ اصلاح شده - open با پارامتر اختیاری برای فایل‌ها
  open(fileGuids?: string[]): void {
    const element = document.getElementById(this.modalId);
    if (!element) return;

    this.resetState();
    this.service.clearAll();
    this.safeUrlCache.clear();

    // ✅ اگه fileGuids پاس داده شده، ازش استفاده کن، وگرنه از existingFileGuids
    const guidsToLoad = fileGuids ?? this.existingFileGuids ?? [];

    this.captureBaseline(guidsToLoad);
    this.ensureModalInstance();

    const guids = guidsToLoad.filter(Boolean);

    if (guids.length) {
      void this.service.loadExistingFiles(guids).finally(() => this.modalInstance?.show());
    } else {
      this.modalInstance?.show();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  async onEsc(ev: Event): Promise<void> {
    if (!this.isOpen()) return;
    if (!(ev instanceof KeyboardEvent)) return;
    ev.preventDefault();

    if (this.showPreview()) {
      this.closePreview();
      return;
    }

    await this.requestClose();
  }

  // ═══════════════════════════════════════════════════════════
  // Baseline / Dirty Check
  // ═══════════════════════════════════════════════════════════

  // ✅ اصلاح شده - می‌تونه guids رو بگیره
  private captureBaseline(guids?: string[]): void {
    const source = guids ?? this.existingFileGuids ?? [];
    this.baselineGuids = new Set(
      source.map(x => this.normGuid(x)).filter(Boolean)
    );
  }

  private currentGuidSet(): Set<string> {
    return new Set(
      this.service.files()
        .filter(f => !!f.fileGuid)
        .map(f => this.normGuid(f.fileGuid!))
        .filter(Boolean)
    );
  }

  private hasUnsavedChanges(): boolean {
    // در حالت readOnly هیچوقت تغییر نداریم
    if (this.readOnly) return false;

    if (this.service.isUploading()) return true;
    if (this.service.pendingFiles().length > 0) return true;
    if (this.service.pausedFiles().length > 0) return true;

    const cur = this.currentGuidSet();
    for (const g of cur) if (!this.baselineGuids.has(g)) return true;
    for (const g of this.baselineGuids) if (!cur.has(g)) return true;

    return false;
  }

  private buildCloseSummaryHtml(): string {
    const total = this.service.totalFiles();
    const pending = this.service.pendingFiles().length;
    const uploading = this.service.uploadingFiles().length;
    const failed = this.service.failedFiles().length;
    const paused = this.service.pausedFiles().length;

    const cur = this.currentGuidSet();
    let removedExisting = 0;
    for (const g of this.baselineGuids) if (!cur.has(g)) removedExisting++;

    const completedNew = this.service.files().filter(f => !f.isExisting && !!f.fileGuid).length;

    return `
      <div style="text-align:right;line-height:1.9">
        <div>وضعیت فعلی:</div>
        <ul style="margin:8px 0 0;padding-right:18px">
          <li>کل فایل‌ها: <b>${total}</b></li>
          <li>در انتظار: <b>${pending}</b></li>
          <li>در حال آپلود: <b>${uploading}</b></li>
          <li>متوقف‌شده: <b>${paused}</b></li>
          <li>خطادار: <b>${failed}</b></li>
          <li>آپلودِ جدیدِ کامل‌شده: <b>${completedNew}</b></li>
          <li>حذف‌شده از فایل‌های اولیه: <b>${removedExisting}</b></li>
        </ul>
        <div style="margin-top:10px;color:#64748b;font-size:12px">
          «ذخیره و خروج» = تکمیل آپلودهای باقی‌مانده و سپس خروج.<br/>
          «عدم ذخیره و خروج» = حذف گروهی فایل‌های آپلودشده‌ی جدید از سرور و خروج.
        </div>
      </div>
    `;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms));
  }

  private async waitForUploadsToFinish(maxMs = 10 * 60 * 1000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (!this.service.isUploading() && this.service.pendingFiles().length === 0 && this.service.pausedFiles().length === 0) return;
      await this.sleep(200);
    }
  }

  async requestClose(): Promise<void> {
    // در حالت readOnly مستقیم ببند
    if (this.readOnly) {
      await this.closeWithoutSave();
      return;
    }

    if (!this.hasUnsavedChanges()) {
      await this.closeWithoutSave();
      return;
    }

    const res = await Swal.fire({
      title: 'خروج از مدیریت فایل',
      html: this.buildCloseSummaryHtml(),
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'ذخیره و خروج',
      denyButtonText: 'عدم ذخیره و خروج',
      cancelButtonText: 'ادامه',
      reverseButtons: true,
      focusCancel: true,
    });

    if (res.isConfirmed) await this.saveAndExit();
    else if (res.isDenied) await this.discardAndExit();
  }

  private async closeWithoutSave(): Promise<void> {
    this.cancelled.emit();
    this.closePreview();
    this.resetState();
    this.service.clearAll();
    this.safeUrlCache.clear();
    this.hideModal();
  }

  private async saveAndExit(): Promise<void> {
    const hasPending = this.service.pendingFiles().length > 0;
    const hasPaused = this.service.pausedFiles().length > 0;
    const isUploading = this.service.isUploading();

    if (isUploading || hasPending || hasPaused) {
      Swal.fire({
        title: 'در حال ذخیره...',
        text: 'در حال تکمیل آپلودها (در صورت وجود)',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      for (const f of this.service.pausedFiles()) this.service.resumeUpload(f.id);

      if (this.service.pendingFiles().length > 0) {
        void this.service.uploadAll({ folderPath: this.folderPath, concurrency: 2 });
      }

      await this.waitForUploadsToFinish();
      Swal.close();
    }

    if (this.service.failedFiles().length > 0) {
      const r = await Swal.fire({
        title: 'برخی فایل‌ها آپلود نشدند',
        text: 'می‌خواهید با فایل‌های موفق ذخیره‌شده خارج شوید؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'بله، خروج',
        cancelButtonText: 'بازگشت',
      });
      if (!r.isConfirmed) return;
    }

    this.emitConfirmedAndClose();
  }

  private async discardAndExit(): Promise<void> {
    const uploadedNewGuids = this.service.files()
      .filter(f => !f.isExisting && !!f.fileGuid)
      .map(f => f.fileGuid as string);

    if (uploadedNewGuids.length > 0) {
      Swal.fire({
        title: 'در حال پاکسازی...',
        text: 'در حال حذف فایل‌های آپلودشده‌ی جدید (گروهی)',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      await this.service.deleteAttachments(uploadedNewGuids);
      Swal.close();
    }

    this.service.clearAll();
    this.safeUrlCache.clear();
    this.cancelled.emit();
    this.closePreview();
    this.resetState();
    this.hideModal();
  }

  async onConfirm(): Promise<void> {
    if (this.disabled || this.readOnly) return;
    await this.saveAndExit();
  }

  private emitConfirmedAndClose(): void {
    const guids = Array.from(this.currentGuidSet().values());
    this.confirmed.emit(guids);

    this.closePreview();
    this.resetState();
    this.service.clearAll();
    this.safeUrlCache.clear();
    this.hideModal();
  }

  // ═══════════════════════════════════════════════════════════
  // File Operations
  // ═══════════════════════════════════════════════════════════

  openFilePicker(): void {
    if (this.disabled || this.readOnly || !this.canUpload || !this.canAddMore()) return;
    this.fileInput?.nativeElement?.click();
  }

  startUpload(): void {
    if (this.readOnly || !this.canUpload) return;
    void this.service.uploadAll({ folderPath: this.folderPath, concurrency: 2 });
  }

  select(id: string): void {
    const wasDifferent = this.selectedId() !== id;
    this.selectedId.set(id);

    if (this.showPreview() && wasDifferent) {
      this.resetZoom();
      void this.service.ensurePreview(id);
    }
  }

  async togglePreview(id: string, event?: Event): Promise<void> {
    event?.stopPropagation();

    const wasOpen = this.showPreview();
    const wasSame = this.selectedId() === id;

    this.selectedId.set(id);

    const willOpen = !wasOpen || !wasSame;
    this.showPreview.set(willOpen);

    if (willOpen) {
      this.resetZoom();
      await this.service.ensurePreview(id);
    }
  }

  closePreview(): void {
    this.showPreview.set(false);
    this.isFullscreen.set(false);
    this.resetZoom();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
  }

  pause(id: string): void {
    if (this.readOnly) return;
    this.service.pauseUpload(id);
  }

  resume(id: string): void {
    if (this.readOnly) return;
    this.service.resumeUpload(id);
  }

  remove(id: string): void {
    if (this.readOnly || !this.canDelete) return;
    if (this.selectedId() === id) this.closePreview();
    this.service.removeFile(id);
  }

  async download(file: FileItem): Promise<void> {
    if (!file.fileGuid) return;
    await this.service.downloadWithAuth(file.fileGuid, file.name);
  }

  async deleteFromServer(file: FileItem): Promise<void> {
    if (!file.fileGuid || this.readOnly || !this.canDelete) return;

    const result = await Swal.fire({
      title: 'حذف فایل از سرور',
      text: 'آیا از حذف این فایل مطمئن هستید؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
      confirmButtonColor: '#d32f2f',
    });

    if (!result.isConfirmed) return;

    const res = await this.service.deleteAttachments([file.fileGuid]);

    const deleted = (res.result?.deletedGuids || []).includes(this.normGuid(file.fileGuid));
    const physicalFailed = (res.result?.physicalDeleteFailedGuids || []).includes(this.normGuid(file.fileGuid));

    if (deleted) {
      if (this.selectedId() === file.id) this.closePreview();
      Swal.fire({ icon: 'success', title: 'حذف شد', text: 'فایل با موفقیت حذف شد.' });
      return;
    }

    if (physicalFailed) {
      Swal.fire({ icon: 'error', title: 'حذف ناقص', text: 'حذف رکورد انجام شد ولی حذف فیزیکی فایل مشکل داشت.' });
      return;
    }

    Swal.fire({ icon: 'error', title: 'خطا', text: res.message || 'حذف فایل با مشکل مواجه شد.' });
  }

  // ═══════════════════════════════════════════════════════════
  // Zoom & Pan
  // ═══════════════════════════════════════════════════════════

  zoomIn(): void {
    this.zoomState.update(s => ({ ...s, scale: Math.min(this.MAX_ZOOM, s.scale + this.ZOOM_STEP) }));
  }
  zoomOut(): void {
    this.zoomState.update(s => ({ ...s, scale: Math.max(this.MIN_ZOOM, s.scale - this.ZOOM_STEP) }));
  }
  zoomFit(): void { this.resetZoom(); }
  zoomActual(): void { this.zoomState.update(s => ({ ...s, scale: 1, translateX: 0, translateY: 0 })); }

  private resetZoom(): void {
    this.zoomState.set({ scale: 1, translateX: 0, translateY: 0, isDragging: false, startX: 0, startY: 0 });
  }

  onPreviewWheel(event: WheelEvent): void {
    const file = this.selectedFile();
    if (!file || this.getFileType(file) !== 'image') return;

    event.preventDefault();

    const delta = event.deltaY > 0 ? -this.ZOOM_STEP : this.ZOOM_STEP;
    this.zoomState.update(s => ({
      ...s,
      scale: Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, s.scale + delta)),
    }));
  }

  onImageMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    this.zoomState.update(s => ({
      ...s,
      isDragging: true,
      startX: event.clientX - s.translateX,
      startY: event.clientY - s.translateY,
    }));
  }

  onImageMouseMove(event: MouseEvent): void {
    const state = this.zoomState();
    if (!state.isDragging) return;

    this.zoomState.update(s => ({
      ...s,
      translateX: event.clientX - s.startX,
      translateY: event.clientY - s.startY,
    }));
  }

  onImageMouseUp(): void {
    this.zoomState.update(s => ({ ...s, isDragging: false }));
  }

  getImageTransform(): string {
    const { scale, translateX, translateY } = this.zoomState();
    return `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  // ═══════════════════════════════════════════════════════════
  // Fullscreen
  // ═══════════════════════════════════════════════════════════

  toggleFullscreen(): void {
    const host = this.previewHost?.nativeElement;
    if (!host) return;

    if (!document.fullscreenElement) host.requestFullscreen?.().catch(() => { });
    else document.exitFullscreen?.().catch(() => { });
  }

  private onFullscreenChange = (): void => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  // ═══════════════════════════════════════════════════════════
  // Drag & Drop
  // ═══════════════════════════════════════════════════════════

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.disabled && !this.readOnly && this.canUpload) this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }
  getFileType(file: FileItem): 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'other' {
    if (!file?.type) return 'other';
    if (this.service.isImage(file.type)) return 'image';
    if (this.service.isPdf(file.type)) return 'pdf';
    if (this.service.isVideo(file.type)) return 'video';
    if (this.service.isAudio(file.type)) return 'audio';
    if (this.service.isText(file.type)) return 'text';
    return 'other';
  }

  getFileIconClass(file: FileItem): string {
    const type = this.getFileType(file);
    const iconMap: Record<string, string> = {
      image: 'fa-image',
      pdf: 'fa-file-pdf',
      video: 'fa-video',
      audio: 'fa-music',
      text: 'fa-file-alt',
      other: 'fa-file',
    };
    return iconMap[type] || 'fa-file';
  }

  getStatusClass(status: UploadStatus): string {
    const map: Record<UploadStatus, string> = {
      [UploadStatus.Pending]: 'status-badge--pending',
      [UploadStatus.InProgress]: 'status-badge--uploading',
      [UploadStatus.Completed]: 'status-badge--completed',
      [UploadStatus.Failed]: 'status-badge--failed',
      [UploadStatus.Paused]: 'status-badge--paused',
      [UploadStatus.Created]: 'status-badge--uploading',
      [UploadStatus.Cancelled]: 'status-badge--failed',
    };
    return map[status] || '';
  }

  getStatusText(status: UploadStatus, progress: number): string {
    const map: Record<UploadStatus, string> = {
      [UploadStatus.Pending]: 'در انتظار',
      [UploadStatus.InProgress]: `${progress}%`,
      [UploadStatus.Completed]: 'کامل',
      [UploadStatus.Failed]: 'خطا',
      [UploadStatus.Paused]: 'متوقف',
      [UploadStatus.Created]: 'در حال شروع',
      [UploadStatus.Cancelled]: 'لغو',
    };
    return map[status] || '';
  }

  previewOpenable(): boolean {
    return !!this.selectedFile()?.previewUrl;
  }

  async openPreviewInNewTab(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    await this.service.ensurePreview(file.id);
    const url = this.selectedFile()?.previewUrl;
    if (url) window.open(url, '_blank', 'noopener');
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  formatSpeed(bps: number): string {
    return `${this.formatSize(bps)}/s`;
  }

  private resetState(): void {
    this.showPreview.set(false);
    this.selectedId.set(null);
    this.isDragOver.set(false);
    this.resetZoom();
  }
}