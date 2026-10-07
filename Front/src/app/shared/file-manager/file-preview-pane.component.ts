import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SafeResourceUrl } from '@angular/platform-browser';

import { TusUploadService, FileItem } from '../../services/framework-services/tus-upload.service';
import {
  FileKind,
  INITIAL_ZOOM_STATE,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  ZoomState,
} from './file-manager.models';
import { formatSize, getFileKind, thumbnailUrl } from './file-manager.utils';

/**
 * پنل پیش‌نمایش فایل انتخاب‌شده (تصویر با زوم/جابجایی، PDF، ویدیو، صدا، متن).
 * وضعیت زوم داخل همین کامپوننت نگهداری می‌شود و با تغییر فایل ریست می‌شود.
 * وضعیت تمام‌صفحه توسط والد (از رویداد fullscreenchange سند) تأمین می‌شود.
 */
@Component({
  selector: 'app-file-preview-pane',
  standalone: true,
  imports: [NgClass],
  template: `
    <aside class="panel-right"
           [class.panel-right--fullscreen]="isFullscreen">

      <header class="preview-header">
        <div class="preview-header__info">
          <i class="fas fa-eye"></i>
          <span>پیش‌نمایش</span>
        </div>

        @if (fileType() === 'image') {
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
                  (click)="openInNewTab.emit()"
                  [disabled]="!file.previewUrl"
                  title="باز کردن در تب جدید">
            <i class="fas fa-external-link-alt"></i>
          </button>

          <button type="button" class="action-btn"
                  (click)="toggleFullscreen()" title="تمام صفحه">
            <i class="fas" [ngClass]="isFullscreen ? 'fa-compress' : 'fa-expand'"></i>
          </button>

          <button type="button" class="action-btn action-btn--danger"
                  (click)="closed.emit()" title="بستن">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </header>

      <div class="preview-body" #previewHost (wheel)="onPreviewWheel($event)">
        @switch (fileType()) {

          @case ('image') {
            <div class="image-preview"
                 [class.image-preview--grabbing]="zoomState().isDragging"
                 (mousedown)="onImageMouseDown($event)"
                 (mousemove)="onImageMouseMove($event)"
                 (mouseup)="onImageMouseUp()"
                 (mouseleave)="onImageMouseUp()">
              <!-- نمایش تدریجی: بندانگشتی (معمولاً از کش) فوراً، نسخه‌ی باکیفیت پس از بارگذاری جایگزین می‌شود -->
              <div class="preview-image-stack" [style.transform]="getImageTransform()">
                @if (!hiResLoaded()) {
                  <img [src]="lowResUrl()" alt="" class="preview-image preview-image--placeholder" draggable="false" />
                }
                <img [src]="hiResUrl()"
                     alt=""
                     class="preview-image"
                     [class.preview-image--pending]="!hiResLoaded()"
                     decoding="async"
                     (load)="hiResLoaded.set(true)"
                     (error)="hiResLoaded.set(true)"
                     draggable="false" />
              </div>
            </div>
          }

          @case ('pdf') {
            @if (safeUrl; as url) {
              <iframe class="preview-iframe" [src]="url"></iframe>
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
                <button type="button" class="btn btn--primary" (click)="downloadFile.emit(file)">
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
            <button type="button" class="btn btn--primary" (click)="downloadFile.emit(file)">
              <i class="fas fa-download"></i>
              دانلود
            </button>
          }
          @if (canDelete && !readOnly && file.fileGuid) {
            <button type="button" class="btn btn--danger" (click)="deleteFile.emit(file)">
              <i class="fas fa-trash-alt"></i>
              حذف
            </button>
          }
        </div>
      </footer>

    </aside>
  `,
  styles: [`
    /* میزبان جعبه‌ای نمی‌سازد تا aside همچنان آیتم مستقیم گرید والد باشد */
    :host { display: contents; }

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

    .preview-image-stack { position: relative; display: grid; place-items: center; max-width: 100%; max-height: 100%; transition: transform .1s ease-out; }
    .preview-image-stack > .preview-image { grid-area: 1 / 1; }
    .preview-image--placeholder { width: min(640px, 80vw); height: auto; filter: blur(10px); }
    .preview-image--pending { opacity: 0; }
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

    .preview-loading {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; color: var(--fm-text-secondary);
    }
    .preview-loading i { margin-bottom: 1rem; color: var(--fm-primary); }
    .preview-loading p { margin: 0; }

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

    .action-btn {
      width: 32px; height: 32px; border: 1px solid var(--fm-border);
      border-radius: var(--fm-radius-sm); background: var(--fm-surface);
      color: var(--fm-text-secondary); cursor: pointer;
      display: grid; place-items: center; font-size: 0.75rem;
      transition: var(--fm-transition);
    }
    .action-btn:hover { border-color: var(--fm-primary); color: var(--fm-primary); background: rgba(13, 71, 161, 0.05); }
    .action-btn--danger:hover { border-color: var(--fm-danger); color: var(--fm-danger); background: rgba(211, 47, 47, 0.05); }

    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 0.5rem 1rem; border: none; border-radius: var(--fm-radius);
      font-family: inherit; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: var(--fm-transition);
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn--primary { background: var(--fm-accent); color: var(--fm-primary-dark); }
    .btn--primary:hover:not(:disabled) { background: var(--fm-accent-light); transform: translateY(-1px); box-shadow: var(--fm-shadow); }
    .btn--danger { background: var(--fm-danger); color: #fff; }
    .btn--danger:hover:not(:disabled) { background: #c62828; }

    @media (max-width: 1200px) {
      .panel-right { position: absolute; inset: 0; z-index: 10; border: none; }
    }
    @media (max-width: 768px) {
      .zoom-controls { order: -1; width: 100%; justify-content: center; }
    }
  `],
})
export class FilePreviewPaneComponent implements OnChanges {
  private readonly service = inject(TusUploadService);

  @Input({ required: true }) file!: FileItem;
  @Input() safeUrl: SafeResourceUrl | null = null;
  @Input() isFullscreen = false;
  @Input() readOnly = false;
  @Input() canDelete = true;

  @Output() closed = new EventEmitter<void>();
  @Output() openInNewTab = new EventEmitter<void>();
  @Output() downloadFile = new EventEmitter<FileItem>();
  @Output() deleteFile = new EventEmitter<FileItem>();

  @ViewChild('previewHost') previewHost?: ElementRef<HTMLElement>;

  readonly MIN_ZOOM = MIN_ZOOM;
  readonly MAX_ZOOM = MAX_ZOOM;
  readonly zoomState = signal<ZoomState>({ ...INITIAL_ZOOM_STATE });
  readonly formatSize = formatSize;

  /** آیا نسخه‌ی باکیفیت تصویر بارگذاری شده است (برای حذف placeholder) */
  readonly hiResLoaded = signal(false);
  lowResUrl(): string { return thumbnailUrl(this.file?.previewUrl, 320); }
  /** حداکثر ۱۹۲۰ پیکسل؛ تصاویر چندمگابایتی دوربین به‌مراتب سریع‌تر نمایش داده می‌شوند */
  hiResUrl(): string { return thumbnailUrl(this.file?.previewUrl, 1920); }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['file'];
    if (change && change.previousValue?.previewUrl !== change.currentValue?.previewUrl) {
      this.hiResLoaded.set(false);
    }
    if (change && !change.firstChange && change.previousValue?.id !== change.currentValue?.id) {
      this.resetZoom();
    }
  }

  fileType(): FileKind {
    return getFileKind(this.file, this.service);
  }

  // ═══════════════════════════════════════════════════════════
  // Zoom & Pan
  // ═══════════════════════════════════════════════════════════

  zoomIn(): void {
    this.zoomState.update(s => ({ ...s, scale: Math.min(MAX_ZOOM, s.scale + ZOOM_STEP) }));
  }
  zoomOut(): void {
    this.zoomState.update(s => ({ ...s, scale: Math.max(MIN_ZOOM, s.scale - ZOOM_STEP) }));
  }
  zoomFit(): void { this.resetZoom(); }
  zoomActual(): void { this.zoomState.update(s => ({ ...s, scale: 1, translateX: 0, translateY: 0 })); }

  resetZoom(): void {
    this.zoomState.set({ ...INITIAL_ZOOM_STATE });
  }

  onPreviewWheel(event: WheelEvent): void {
    if (!this.file || this.fileType() !== 'image') return;

    event.preventDefault();

    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    this.zoomState.update(s => ({
      ...s,
      scale: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.scale + delta)),
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
}
