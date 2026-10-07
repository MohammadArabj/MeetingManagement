import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TusUploadService } from '../../services/framework-services/tus-upload.service';

/**
 * 🎨 File Uploader Component
 *
 * کامپوننت کامل و قابل استفاده مجدد برای آپلود فایل با:
 * - Drag & Drop
 * - Progress Tracking
 * - Preview (Image/Video/PDF)
 * - Validation
 * - Delete
 *
 * 🔴 Bug Fix:
 *   - uploadAll() → uploadFile(item.id) تا فقط فایل همین instance آپلود شود
 *   - removeFile() بعد از آپلود موفق صدا زده می‌شود تا queue پاک بماند
 *   - در صورت خطا نیز cleanup انجام می‌شود
 */
@Component({
  selector: 'app-file-uploader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fileUploader">
      @if (label) {
        <div class="fileUploader__label">
          <i [class]="'fa fa-' + icon"></i>
          {{ label }}
          @if (required) {
            <span class="required">*</span>
          }
        </div>
      }

      @if (help) {
        <div class="fileUploader__help">
          <i class="fa fa-info-circle"></i>
          {{ help }}
        </div>
      }

      @if (!fileGuid()) {
        <!-- Upload Zone -->
        <div
          class="uploadZone"
          [class.dragover]="isDragOver()"
          (click)="fileInput.click()"
          (drop)="onDrop($event)"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)">

          <i class="fa fa-cloud-upload"></i>
          <p>{{ dragDropText }}</p>
          <span class="uploadZone__formats">
            {{ acceptText }}
            @if (maxSizeMB) {
              - حداکثر {{ maxSizeMB }}MB
            }
          </span>
        </div>

        <input
          #fileInput
          type="file"
          [accept]="accept"
          (change)="onFileSelect($event)"
          hidden>

      } @else {
        <!-- Preview -->
        <div class="filePreview">
          @if (isUploading()) {
            <div class="uploadProgress">
              <div class="progressBar">
                <div class="progressBar__fill" [style.width.%]="uploadProgress()"></div>
              </div>
              <div class="progressInfo">
                <span>{{ uploadProgress() }}%</span>
                <span class="speed">{{ formatSpeed(uploadSpeed()) }}</span>
              </div>
            </div>
          } @else {
            @if (previewUrl()) {
              <div class="previewContent">
                @if (isImage()) {
                  <img [src]="previewUrl()" [alt]="fileName()">
                } @else if (isVideo()) {
                  <video [src]="previewUrl()" controls></video>
                } @else if (isPdf()) {
                  <iframe [src]="previewUrl()" frameborder="0"></iframe>
                } @else {
                  <div class="fileIcon">
                    <i [class]="'fa fa-file-' + getFileIconType()"></i>
                    <span>{{ fileName() }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="previewLoading">
                <i class="fa fa-spinner fa-spin"></i>
                <span>در حال بارگذاری...</span>
              </div>
            }

            <div class="previewActions">
              <button type="button" class="btn sm danger" (click)="removeFile()">
                <i class="fa fa-trash"></i>
                حذف
              </button>
            </div>
          }
        </div>
      }

      @if (errorMessage()) {
        <div class="errorMessage">
          <i class="fa fa-exclamation-circle"></i>
          {{ errorMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .fileUploader { width: 100%; }

    .fileUploader__label {
      display: flex; align-items: center; gap: 8px;
      font-weight: 800; font-size: 0.95rem; color: var(--ink);
      margin-bottom: 12px;
    }
    .fileUploader__label i { color: var(--primary); }
    .required { color: var(--accent); font-weight: 900; }

    .fileUploader__help {
      display: flex; gap: 8px; padding: 10px 14px;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 10px; color: #1e40af;
      font-size: 0.85rem; margin-bottom: 12px; line-height: 1.5;
    }

    .uploadZone {
      border: 2px dashed var(--line); border-radius: 16px;
      padding: 48px 24px; text-align: center; cursor: pointer;
      transition: all 0.3s ease; background: rgba(249, 250, 251, 0.5);
    }
    .uploadZone:hover {
      border-color: var(--primary);
      background: rgba(29, 78, 216, 0.05);
    }
    .uploadZone.dragover {
      border-color: var(--primary);
      background: rgba(29, 78, 216, 0.10);
      border-style: solid;
    }
    .uploadZone i {
      font-size: 3rem; color: var(--primary);
      margin-bottom: 16px; display: block;
    }
    .uploadZone p {
      margin: 0 0 8px 0; font-weight: 800;
      font-size: 1.05rem; color: var(--ink);
    }
    .uploadZone__formats {
      font-size: 0.85rem; color: var(--muted); display: block;
    }

    .filePreview {
      border: 2px solid var(--line); border-radius: 16px;
      overflow: hidden; background: white;
    }
    .previewContent {
      position: relative; min-height: 200px;
      display: flex; align-items: center; justify-content: center;
      background: #f8f9fa;
    }
    .previewContent img {
      max-width: 100%; max-height: 400px; object-fit: contain;
    }
    .previewContent video { max-width: 100%; max-height: 400px; }
    .previewContent iframe { width: 100%; height: 500px; }

    .fileIcon {
      display: flex; flex-direction: column;
      align-items: center; gap: 16px; padding: 40px;
    }
    .fileIcon i { font-size: 4rem; color: var(--primary); }
    .fileIcon span { font-weight: 800; color: var(--ink); }

    .previewLoading {
      display: flex; flex-direction: column;
      align-items: center; gap: 16px; padding: 60px 24px;
      color: var(--muted);
    }
    .previewLoading i { font-size: 2.5rem; }

    .previewActions {
      padding: 16px; border-top: 2px solid var(--line);
      display: flex; justify-content: center; gap: 12px;
    }

    .uploadProgress { padding: 24px; }
    .progressBar {
      height: 8px; background: rgba(148, 163, 184, 0.2);
      border-radius: 999px; overflow: hidden; margin-bottom: 12px;
    }
    .progressBar__fill {
      height: 100%; background: linear-gradient(90deg, #1d4ed8, #3b82f6);
      border-radius: 999px; transition: width 0.3s ease;
    }
    .progressInfo {
      display: flex; justify-content: space-between;
      align-items: center; font-size: 0.9rem; color: var(--muted);
    }
    .progressInfo span:first-child {
      font-weight: 900; color: var(--primary);
    }

    .errorMessage {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px;
      background: rgba(255, 77, 109, 0.08);
      border: 1px solid rgba(255, 77, 109, 0.3);
      border-radius: 10px; color: var(--accent);
      font-size: 0.9rem; margin-top: 12px;
    }
  `]
})
export class FileUploaderComponent implements OnInit {
  @Input() label?: string;
  @Input() help?: string;
  @Input() icon: string = 'image';
  @Input() required: boolean = false;
  @Input() accept: string = 'image/*';
  @Input() acceptText: string = 'PNG, JPG, GIF';
  @Input() maxSizeMB: number = 5;
  @Input() folderPath: string = 'uploads';
  @Input() dragDropText: string = 'کلیک کنید یا فایل را اینجا بکشید';
  @Input() fileGuid = signal<string | undefined>(undefined);

  @Output() fileUploaded = new EventEmitter<string>();
  @Output() fileRemoved = new EventEmitter<void>();

  private readonly tusUploadService = inject(TusUploadService);

  readonly isDragOver = signal(false);
  readonly isUploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly uploadSpeed = signal(0);
  readonly previewUrl = signal<string | null>(null);
  readonly fileName = signal('');
  readonly fileType = signal('');
  readonly errorMessage = signal<string | null>(null);

  // ✅ نگه‌داشتن id فایل فعلی در queue سرویس
  private currentFileId?: string;
  private progressInterval?: ReturnType<typeof setInterval>;

  readonly isImage = computed(() => this.fileType().startsWith('image/'));
  readonly isVideo = computed(() => this.fileType().startsWith('video/'));
  readonly isPdf = computed(() => this.fileType() === 'application/pdf');

  async ngOnInit() {
    const guid = this.fileGuid();
    if (guid) await this.loadPreview(guid);
  }

  private async loadPreview(guid: string): Promise<void> {
    try {
      const url = await this.tusUploadService.getFilePreviewUrl(guid);
      if (url) {
        this.previewUrl.set(url);
        const metas = await this.tusUploadService.getMetas([guid]);
        const meta = metas[0];
        if (meta) {
          this.fileName.set(meta.originalFileName || meta.fileName);
          this.fileType.set(meta.contentType);
        }
      }
    } catch {
      this.errorMessage.set('خطا در بارگذاری پیش‌نمایش');
    }
  }

  async onFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.doUpload(input.files[0]);
    // ✅ ریست input تا همان فایل دوباره قابل انتخاب باشد
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) await this.doUpload(file);
  }

  // ==================== Upload ====================

  private async doUpload(file: File): Promise<void> {
    this.errorMessage.set(null);

    // اعتبارسنجی فایل
    const validation = this.validateFile(file);
    if (!validation.valid) {
      this.errorMessage.set(validation.error ?? 'فایل نامعتبر است');
      return;
    }

    // ✅ پاک‌سازی فایل قبلی از queue (در صورت وجود)
    this.cleanupCurrentFile();

    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadSpeed.set(0);
    this.fileName.set(file.name);
    this.fileType.set(file.type);

    try {
      // ✅ اضافه کردن فایل به queue
      const items = this.tusUploadService.addFiles([file], {
        maxFiles: 1,
        maxSizeMB: this.maxSizeMB,
        acceptedTypes: [this.accept],
        localPreview: true,
      });

      if (!items.length) {
        throw new Error('خطا در افزودن فایل به صف آپلود');
      }

      const item = items[0];
      this.currentFileId = item.id;

      // نمایش preview محلی
      if (item.previewUrl) {
        this.previewUrl.set(item.previewUrl);
      }

      // ✅ نمایش پیشرفت آپلود
      this.progressInterval = setInterval(() => {
        if (!this.currentFileId) return;
        const current = this.tusUploadService.filesMap().get(this.currentFileId);
        if (current) {
          this.uploadProgress.set(current.progress ?? 0);
          this.uploadSpeed.set(current.speed ?? 0);
        }
      }, 100);

      // ✅ فقط همین فایل را آپلود کن (نه uploadAll)
      const guid = await this.tusUploadService.uploadFile(item.id, {
        folderPath: this.folderPath,
        description: this.label ?? 'File upload',
      });

      // متوقف کردن polling
      this.stopProgressInterval();

      if (!guid) {
        throw new Error('آپلود فایل ناموفق بود');
      }

      // دریافت URL از سرور
      const serverUrl = await this.tusUploadService.getFilePreviewUrl(guid);
      if (serverUrl) this.previewUrl.set(serverUrl);

      // ✅ تنظیم guid و emit
      this.fileGuid.set(guid);
      this.fileUploaded.emit(guid);

    } catch (error: any) {
      this.errorMessage.set(error?.message ?? 'خطا در آپلود فایل');
      this.previewUrl.set(null);
    } finally {
      // ✅ در هر صورت (موفق یا ناموفق) فایل را از queue پاک کن
      this.cleanupCurrentFile();
      this.stopProgressInterval();
      this.isUploading.set(false);
    }
  }

  // ==================== Remove ====================

  async removeFile(): Promise<void> {
    const guid = this.fileGuid();
    if (!guid) return;

    try {
      const result = await this.tusUploadService.deleteAttachment(guid);
      if (result) {
        this.fileGuid.set(undefined);
        this.previewUrl.set(null);
        this.fileName.set('');
        this.fileType.set('');
        this.errorMessage.set(null);
        this.fileRemoved.emit();
      } else {
        this.errorMessage.set('خطا در حذف فایل');
      }
    } catch {
      this.errorMessage.set('خطا در حذف فایل');
    }
  }

  // ==================== Helpers ====================

  private cleanupCurrentFile(): void {
    if (this.currentFileId) {
      try {
        this.tusUploadService.removeFile(this.currentFileId);
      } catch {
        // نادیده گرفتن خطای cleanup
      }
      this.currentFileId = undefined;
    }
  }

  private stopProgressInterval(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = undefined;
    }
  }

  private validateFile(file: File): { valid: boolean; error?: string } {
    if (this.accept !== '*' && !this.matchesAccept(file)) {
      return { valid: false, error: 'نوع فایل مجاز نیست' };
    }
    if (this.maxSizeMB && file.size > this.maxSizeMB * 1024 * 1024) {
      return { valid: false, error: `حجم فایل نباید بیشتر از ${this.maxSizeMB}MB باشد` };
    }
    return { valid: true };
  }

  private matchesAccept(file: File): boolean {
    const rules = this.accept.split(',').map((r) => r.trim());
    for (const rule of rules) {
      if (rule === '*') return true;
      if (rule.startsWith('.') && file.name.toLowerCase().endsWith(rule.toLowerCase())) return true;
      if (rule.endsWith('/*') && file.type.startsWith(rule.replace('/*', '/'))) return true;
      if (file.type === rule) return true;
    }
    return false;
  }

  formatSpeed(bytesPerSecond: number): string {
    if (!bytesPerSecond) return '';
    const kbps = bytesPerSecond / 1024;
    const mbps = kbps / 1024;
    return mbps >= 1 ? `${mbps.toFixed(1)} MB/s` : `${kbps.toFixed(0)} KB/s`;
  }

  getFileIconType(): string {
    const type = this.fileType();
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type === 'application/pdf') return 'pdf';
    if (type.includes('word')) return 'word';
    if (type.includes('excel')) return 'excel';
    if (type.includes('powerpoint')) return 'powerpoint';
    if (type.includes('zip')) return 'archive';
    return 'alt';
  }
}