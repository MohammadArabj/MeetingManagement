// file-management-modal.component.ts

import { Component, input, output, signal, computed, effect, inject, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FileService } from '../../../../../services/file.service';
import { TusUploadService } from '../../../../../services/framework-services/tus-upload.service';
import { ToastService } from '../../../../../services/framework-services/toast.service';
import { MeetingRoles } from '../../../../../core/meeting-access/meeting-roles';

declare var Swal: any;

// ✅ اصلاح شده - فقط id و fileGuid از API می‌آید
interface FileAttachment {
  id: number;
  fileGuid: string;  // ✅ نام صحیح فیلد
}

// ✅ فایل پردازش شده با اطلاعات کامل از مدیریت فایل
interface ProcessedFile {
  id: number;
  fileGuid: string;
  fileName: string;
  fileSize: number;
  formattedSize: string;
  contentType: string;
  url: string;
  displayType: FileDisplayType;
  isLoading: boolean;
  isLoaded: boolean;
  error?: string;
}

type FileDisplayType = 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'document' | 'other';

@Component({
  selector: 'app-file-management-modal',
  standalone: true,
  imports: [],
  templateUrl: './file-management-modal.html',
  styleUrl: './file-management-modal.css',
})
export class FileManagementModalComponent implements OnInit {
  private readonly fileService = inject(FileService);
  private readonly tusUploadService = inject(TusUploadService);
  private readonly toastService = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  // Input signals
  attachments = input<FileAttachment[]>([]);
  roleId = input<any>();
  statusId = input<any>();

  // Output signals
  fileViewed = output<any>();
  fileDownloaded = output<string>();
  fileDeleted = output<string>();
  modalClosed = output<void>();

  // ✅ Internal state signals
  private readonly _processedFiles = signal<ProcessedFile[]>([]);
  private readonly _isLoadingFiles = signal<boolean>(false);
  private readonly _previewFile = signal<ProcessedFile | null>(null);
  private readonly _previewUrl = signal<SafeResourceUrl | null>(null);
  private readonly _isLoadingPreview = signal<boolean>(false);

  // Readonly accessors
  readonly processedFiles = this._processedFiles.asReadonly();
  readonly isLoadingFiles = this._isLoadingFiles.asReadonly();
  readonly previewFile = this._previewFile.asReadonly();
  readonly previewUrl = this._previewUrl.asReadonly();
  readonly isLoadingPreview = this._isLoadingPreview.asReadonly();

  // ✅ Computed signals
  readonly hasFiles = computed(() => this._processedFiles().length > 0);
  readonly fileCount = computed(() => this._processedFiles().length);
  readonly isPreviewOpen = computed(() => this._previewFile() !== null);

  readonly canDeleteFiles = computed(() => {
    const roleId = this.roleId();
    const statusId = this.statusId();
    return MeetingRoles.can(roleId, 'UploadFiles') && ![4, 6].includes(statusId);
  });

  constructor() {
    // ✅ Effect برای لود اطلاعات فایل‌ها وقتی attachments تغییر می‌کند
    effect(() => {
      const attachments = this.attachments();
      if (attachments && attachments.length > 0) {
        this.loadFileDetails(attachments);
      } else {
        this._processedFiles.set([]);
      }
    });
  }

  ngOnInit(): void {
    // Initial load handled by effect
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ لود اطلاعات فایل‌ها از مدیریت فایل - اصلاح شده
  // ═══════════════════════════════════════════════════════════

  private async loadFileDetails(attachments: FileAttachment[]): Promise<void> {
    this._isLoadingFiles.set(true);

    // ✅ ابتدا فایل‌ها را با اطلاعات اولیه (فقط id و fileGuid) نمایش بده
    const initialFiles: ProcessedFile[] = attachments.map((att, index) => ({
      id: att.id,
      fileGuid: att.fileGuid,
      fileName: `فایل ${index + 1}`,  // نام موقت
      fileSize: 0,
      formattedSize: '',
      contentType: '',
      url: '',
      displayType: 'other' as FileDisplayType,
      isLoading: true,
      isLoaded: false
    }));

    this._processedFiles.set(initialFiles);

    // ✅ جمع‌آوری GUID ها
    const guids = attachments
      .map(att => att.fileGuid)
      .filter(guid => guid && guid !== '00000000-0000-0000-0000-000000000000');

    if (guids.length === 0) {
      this._isLoadingFiles.set(false);
      return;
    }

    try {
      // ✅ گرفتن اطلاعات کامل از مدیریت فایل
      const metas = await this.tusUploadService.getMetas(guids);

      // ✅ آپدیت فایل‌ها با اطلاعات کامل از مدیریت فایل
      this._processedFiles.update(files =>
        files.map(file => {
          const meta = metas.find((m: any) =>
            m?.guid?.toLowerCase() === file.fileGuid?.toLowerCase()
          );

          if (meta) {
            const url = meta.path
              ? this.tusUploadService.buildFileUrl(meta.path)
              : '';

            const fileName = meta.originalFileName || meta.fileName  || `فایل`;
            const contentType = meta.contentType || meta.contentType || '';

            return {
              ...file,
              fileName: fileName,
              fileSize: meta.fileSize  || 0,
              formattedSize: this.formatFileSize(meta.fileSize || 0),
              contentType: contentType,
              displayType: this.determineFileType(contentType, fileName),
              url: url,
              isLoading: false,
              isLoaded: true
            };
          }

          // ✅ اگر meta پیدا نشد
          return {
            ...file,
            fileName: `فایل ${file.id}`,
            isLoading: false,
            isLoaded: false,
            error: 'اطلاعات فایل یافت نشد'
          };
        })
      );

    } catch (error) {
      console.error('Error loading file details:', error);
      this.toastService.warning('برخی اطلاعات فایل‌ها بارگذاری نشد');

      // ✅ علامت‌گذاری همه به عنوان لود نشده
      this._processedFiles.update(files =>
        files.map(file => ({
          ...file,
          isLoading: false,
          isLoaded: false,
          error: 'خطا در بارگذاری'
        }))
      );
    } finally {
      this._isLoadingFiles.set(false);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ نمایش پیش‌نمایش فایل داخل مودال
  // ═══════════════════════════════════════════════════════════

  async viewFile(fileGuid: string, event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const file = this._processedFiles().find(f => f.fileGuid === fileGuid);
    if (!file) {
      this.toastService.error('فایل یافت نشد');
      return;
    }

    this._isLoadingPreview.set(true);
    this._previewFile.set(file);

    try {
      // ✅ اگر URL داریم، مستقیم استفاده کن
      if (file.url) {
        this._previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(file.url));
        this._isLoadingPreview.set(false);
        return;
      }

      // ✅ اگر URL نداریم، از مدیریت فایل بگیر
      const metas = await this.tusUploadService.getMetas([fileGuid]);
      const meta = metas[0];

      if (meta && meta.path) {
        const url = this.tusUploadService.buildFileUrl(meta.path);

        // ✅ آپدیت فایل با URL
        this._processedFiles.update(files =>
          files.map(f =>
            f.fileGuid === fileGuid
              ? { ...f, url, isLoaded: true }
              : f
          )
        );

        this._previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      } else {
        throw new Error('URL فایل یافت نشد');
      }

    } catch (error) {
      console.error('Error loading preview:', error);
      this.toastService.error('خطا در بارگذاری پیش‌نمایش');
      this._previewFile.set(null);
    } finally {
      this._isLoadingPreview.set(false);
    }
  }

  // ✅ بستن پیش‌نمایش
  closePreview(): void {
    this._previewFile.set(null);
    this._previewUrl.set(null);
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ دانلود فایل
  // ═══════════════════════════════════════════════════════════

  async downloadFile(fileGuid: string): Promise<void> {
    const file = this._processedFiles().find(f => f.fileGuid === fileGuid);
    if (!file) {
      this.toastService.error('فایل یافت نشد');
      return;
    }

    try {
      let downloadUrl = file.url;

      // ✅ اگر URL نداریم، از مدیریت فایل بگیر
      if (!downloadUrl) {
        const metas = await this.tusUploadService.getMetas([fileGuid]);
        const meta = metas[0];
        if (meta && meta.path) {
          downloadUrl = this.tusUploadService.buildFileUrl(meta.path);
        }
      }

      if (!downloadUrl) {
        this.toastService.error('لینک دانلود یافت نشد');
        return;
      }

      // ✅ دانلود فایل
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.fileName || 'download';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      this.fileDownloaded.emit(fileGuid);
      this.toastService.success('دانلود شروع شد');

    } catch (error) {
      console.error('Error downloading file:', error);
      this.toastService.error('خطا در دانلود فایل');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ حذف فایل - اصلاح شده برای استفاده از id
  // ═══════════════════════════════════════════════════════════

  confirmDeleteFile(fileId: number): void {
    if (!this.canDeleteFiles()) {
      this.toastService.error('شما مجوز حذف فایل را ندارید.');
      return;
    }

    const file = this._processedFiles().find(f => f.id === fileId);
    if (!file) {
      this.toastService.error('فایل یافت نشد');
      return;
    }

    const fileName = file.fileName || 'این فایل';

    Swal.fire({
      title: 'حذف فایل پیوست',
      text: `آیا از حذف "${fileName}" اطمینان دارید؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف شود',
      cancelButtonText: 'خیر',
      reverseButtons: true
    }).then((result: { isConfirmed: any }) => {
      if (result.isConfirmed) {
        // ✅ ارسال fileGuid برای حذف
        this.fileDeleted.emit(file.fileGuid);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ Helper Methods
  // ═══════════════════════════════════════════════════════════

  private determineFileType(contentType: string, fileName: string): FileDisplayType {
    if (contentType?.includes('image')) return 'image';
    if (contentType === 'application/pdf') return 'pdf';
    if (contentType?.includes('text')) return 'text';
    if (contentType?.includes('video')) return 'video';
    if (contentType?.includes('audio')) return 'audio';
    if (contentType?.includes('document') ||
      contentType?.includes('word') ||
      contentType?.includes('excel') ||
      contentType?.includes('powerpoint')) return 'document';

    const extension = fileName?.toLowerCase().split('.').pop();
    switch (extension) {
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'bmp': case 'svg': case 'webp':
        return 'image';
      case 'pdf':
        return 'pdf';
      case 'txt': case 'json': case 'xml': case 'csv': case 'log':
        return 'text';
      case 'mp4': case 'avi': case 'mov': case 'wmv': case 'webm':
        return 'video';
      case 'mp3': case 'wav': case 'ogg': case 'aac':
        return 'audio';
      case 'doc': case 'docx': case 'xls': case 'xlsx': case 'ppt': case 'pptx':
        return 'document';
      default:
        return 'other';
    }
  }

  private formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getFileIcon(type: FileDisplayType): string {
    const iconMap: Record<FileDisplayType, string> = {
      image: 'fa-file-image',
      pdf: 'fa-file-pdf',
      text: 'fa-file-alt',
      video: 'fa-file-video',
      audio: 'fa-file-audio',
      document: 'fa-file-word',
      other: 'fa-file'
    };
    return iconMap[type];
  }

  closeModal(): void {
    this.closePreview();
    this.modalClosed.emit();
  }

  trackByGuid(index: number, file: ProcessedFile): string {
    return file.fileGuid || index.toString();
  }
}