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
} from '../../services/framework-services/tus-upload.service';
import { AppSettings } from '../../services/system-setting.service';

import { FileKind, ViewMode } from './file-manager.models';
import {
  formatSize,
  formatSpeed,
  getFileIconClass,
  getFileKind,
  getStatusClass,
  getStatusText,
  normGuid,
} from './file-manager.utils';
import { FileManagerHeaderComponent } from './file-manager-header.component';
import { FileDropzoneComponent } from './file-dropzone.component';
import { FileGridComponent } from './file-grid.component';
import { FileTableComponent } from './file-table.component';
import { FilePreviewPaneComponent } from './file-preview-pane.component';

declare const Swal: any;
declare const bootstrap: any;

@Component({
  selector: 'app-file-manager-modal',
  standalone: true,
  imports: [
    CommonModule,
    FileManagerHeaderComponent,
    FileDropzoneComponent,
    FileGridComponent,
    FileTableComponent,
    FilePreviewPaneComponent,
  ],
  templateUrl: './file-manger-modal.component.html',
  styleUrls: ['./file-manger-modal.component.css'],
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
  // Safe URL Cache
  private readonly safeUrlCache = new Map<string, SafeResourceUrl>();

  private modalInstance: any;
  private modalEl?: HTMLElement;
  private modalHandlersRegistered = false;
  private allowHideOnce = false;
  private promptingClose = false;

  private baselineGuids = new Set<string>();
  private normGuid(g: string): string { return normGuid(g); }

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

    // ریست زوم با تغییر فایل داخل FilePreviewPaneComponent انجام می‌شود
    if (this.showPreview() && wasDifferent) {
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

    // پنل پیش‌نمایش با وضعیت زوم اولیه ساخته می‌شود / با تغییر فایل زوم را ریست می‌کند
    if (willOpen) {
      await this.service.ensurePreview(id);
    }
  }

  closePreview(): void {
    this.showPreview.set(false);
    this.isFullscreen.set(false);

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
  // Fullscreen (درخواست تمام‌صفحه در FilePreviewPaneComponent انجام می‌شود)
  // ═══════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════
  // Helpers (پیاده‌سازی در file-manager.utils.ts)
  // ═══════════════════════════════════════════════════════════

  getFileType(file: FileItem): FileKind { return getFileKind(file, this.service); }
  getFileIconClass(file: FileItem): string { return getFileIconClass(this.getFileType(file)); }
  getStatusClass(status: UploadStatus): string { return getStatusClass(status); }
  getStatusText(status: UploadStatus, progress: number): string { return getStatusText(status, progress); }
  formatSize(bytes: number): string { return formatSize(bytes); }
  formatSpeed(bps: number): string { return formatSpeed(bps); }

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

  private resetState(): void {
    this.showPreview.set(false);
    this.selectedId.set(null);
    this.isDragOver.set(false);
  }
}