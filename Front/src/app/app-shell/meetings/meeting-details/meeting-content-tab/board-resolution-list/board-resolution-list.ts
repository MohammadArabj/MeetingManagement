
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, DestroyRef, effect, inject, input, output, signal, TemplateRef, untracked, ViewChild } from '@angular/core';
import { Collapse } from 'bootstrap';
import { MeetingDetails } from '../../../../../core/models/Meeting';
import { Resolution } from '../../../../../core/models/Resolution';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FileMeetingService } from '../../../../../services/file-meeting.service';
import { TusUploadService } from '../../../../../services/framework-services/tus-upload.service';
import { ToastService } from '../../../../../services/framework-services/toast.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ReportMode } from '../../../../../core/types/configuration';
import { AgendaService } from '../../../../../services/agenda.service';
import { RichTextViewComponent } from '../../../../../shared/rich-text-editor/rich-text-view.component';

declare var Swal: any;
interface FileItem {
  id?: number;
  name?: string;
  size?: number;
  sizeFormatted?: string;
  url: string;
  uploadDate: string;
  type: string;
  file?: File;
  guid?: string;

  // جدید
  isAgendaFile?: boolean;
  agendaText?: string;
  agendaIndex?: number;

  // وضعیت‌ها
  isLoading?: boolean;
  isLoaded?: boolean;
  error?: string;
}


@Component({
  selector: 'app-board-resolution-list',
  templateUrl: './board-resolution-list.html',
  styleUrl: './board-resolution-list.css',
  imports: [RichTextViewComponent],
})
export class BoardResolutionList {
  private destroyRef = inject(DestroyRef);
  private fileMeetingService = inject(FileMeetingService);
  private tusUploadService = inject(TusUploadService);  // ✅ اضافه شد
  private toastService = inject(ToastService);          // ✅ اضافه شد
  private sanitizer = inject(DomSanitizer);
  private agendaService = inject(AgendaService);
  expandedResolutionIndex: number | null = null;
  @ViewChild('descriptionModal') descriptionModal!: TemplateRef<any>;
  @ViewChild('documentationModal') documentationModal!: TemplateRef<any>;
  private modalService = inject(NgbModal);
  modalRef: any = null;
  modalContent: string = '';

  // File management signals
  private readonly _selectedResolutionFiles = signal<Map<number, FileItem[]>>(new Map());
  private readonly _selectedFileForPreview = signal<FileItem | null>(null);
  private readonly _showFilePreview = signal<boolean>(false);
  private readonly _loadingFiles = signal<Set<number>>(new Set());
  private readonly _deletingFiles = signal<Set<number>>(new Set());
  private readonly _pdfUrl = signal<SafeResourceUrl | null>(null);
  private readonly _isLoadingPreview = signal<boolean>(false);  // ✅ اضافه شد
  private readonly _agendaFiles = signal<FileItem[]>([]);
  private readonly _loadingAgendaFiles = signal<boolean>(false);

  readonly agendaFiles = this._agendaFiles.asReadonly();
  readonly isLoadingAgendaFiles = this._loadingAgendaFiles.asReadonly();

  readonly hasAgendaFiles = computed(() => this._agendaFiles().length > 0);
  readonly agendaFilesCount = computed(() => this._agendaFiles().length);
  // Public readonly signals
  readonly selectedResolutionFiles = this._selectedResolutionFiles.asReadonly();
  readonly selectedFileForPreview = this._selectedFileForPreview.asReadonly();
  readonly showFilePreview = this._showFilePreview.asReadonly();
  readonly loadingFiles = this._loadingFiles.asReadonly();
  readonly deletingFiles = this._deletingFiles.asReadonly();
  readonly pdfUrl = this._pdfUrl.asReadonly();
  readonly isLoadingPreview = this._isLoadingPreview.asReadonly();  // ✅ اضافه شد

  // Input signals
  resolutions = input<Resolution[]>([]);
  canDrag = input<boolean>(false);
  canEditResolution = input<boolean>(false);
  canAddResolution = input<boolean>(false);
  canDeleteResolution = input<boolean>(false);
  canAddAssignment = input<boolean>(false);
  canViewFiles = input<boolean>(false);
  canDeleteFile = input<boolean>(false);
  roleId = input<any>();
  statusId = input<any>();
  meeting = input.required<MeetingDetails | null>();


  // Output signals
  resolutionDropped = output<CdkDragDrop<Resolution[]>>();
  addResolution = output<void>();
  editResolution = output<Resolution>();
  deleteResolution = output<Resolution>();
  assignResolution = output<Resolution>();
  showFiles = output<number>();
  printResolution = output<{ resolution: Resolution; index: number }>();
  editAssignment = output<number>();
  deleteAssignment = output<any>();
  printAllResolutions = output<void>();
  refreshFilesRequested = output<number>();

  // Internal signals
  private collapseStates = signal<Map<string, boolean>>(new Map());

  // Computed signals
  hasResolutions = computed(() => this.resolutions().length > 0);
  dragEnabled = computed(() => this.canDrag() && this.hasResolutions());

  resolutionHasFiles = computed(() => {
    const filesMap = this._selectedResolutionFiles();
    return (resolutionId: number) => {
      const files = filesMap.get(resolutionId);
      return files && files.length > 0;
    };
  });

  getFilesCount = computed(() => {
    const filesMap = this._selectedResolutionFiles();
    return (resolutionId: number) => {
      const files = filesMap.get(resolutionId);
      return files ? files.length : 0;
    };
  });

  canPerformActions = computed(() => ({
    edit: this.canEditResolution(),
    delete: this.canDeleteResolution(),
    assign: this.canAddAssignment(),
    viewFiles: this.canViewFiles(),
    deleteFile: this.canDeleteFile(),
    showReport: this.canShowActionsReport()  // ✅ اضافه شد
  }));


  constructor() {
    effect(() => {
      const resolutionCount = this.resolutions().length;
    });
    const helpDismissed = localStorage.getItem('board-resolution-report-help-dismissed');
    if (helpDismissed === 'true') {
      this.showHelpBanner.set(false);
    }
    effect(() => {
      const resolutions = this.resolutions();
      if (resolutions.length > 0) {
        resolutions.forEach(resolution => {
          if (resolution.id) {
            const hasFiles = this._selectedResolutionFiles().has(resolution.id);
            if (!hasFiles && !this._loadingFiles().has(resolution.id)) {
              this.loadFilesForResolution(resolution.id);
            }
          }
        });
      }
    });
    effect(() => {
      const mt = this.meeting();
      const guid = (mt as any)?.guid || (mt as any)?.meetingGuid;
      if (guid) {
        untracked(() => this.loadAgendaFiles());
        ;
      }
    });
  }
  async loadAgendaFiles(): Promise<void> {
    const meeting = this.meeting();
    const meetingGuid = (meeting as any)?.guid || (meeting as any)?.meetingGuid;
    if (!meetingGuid) return;

    if (this._loadingAgendaFiles()) return;
    this._loadingAgendaFiles.set(true);

    this._agendaFiles.set([{
      id: -10,
      name: 'در حال بارگذاری فایل‌های دستور جلسه...',
      url: '',
      uploadDate: '',
      type: 'loading',
      isAgendaFile: true,
      isLoading: true
    }]);

    this.agendaService.getListBy(meetingGuid).subscribe({
      next: async (data: any[]) => {
        // پاک کردن placeholder
        this._agendaFiles.set([]);

        if (!data || data.length === 0) {
          this._loadingAgendaFiles.set(false);
          return;
        }

        // استخراج فایل‌ها
        const agendaFilesInfo: { agendaIndex: number; agendaText: string; fileGuid: string }[] = [];

        data.forEach((agenda: any, index: number) => {
          const agendaIndex = index + 1;
          const agendaText = agenda.text || `دستور جلسه ${agendaIndex}`;

          if (Array.isArray(agenda.files)) {
            agenda.files.forEach((f: any) => {
              const g = f.fileGuid || f.guid;
              if (g && g !== '00000000-0000-0000-0000-000000000000') {
                agendaFilesInfo.push({ agendaIndex, agendaText, fileGuid: g });
              }
            });
          } else {
            const g = agenda.fileGuid || agenda.guid;
            if (g && g !== '00000000-0000-0000-0000-000000000000') {
              agendaFilesInfo.push({ agendaIndex, agendaText, fileGuid: g });
            }
          }
        });

        if (agendaFilesInfo.length === 0) {
          this._loadingAgendaFiles.set(false);
          return;
        }

        // placeholder های واقعی برای هر فایل
        const placeholders: FileItem[] = agendaFilesInfo.map((info, idx) => ({
          id: Date.now() + idx + Math.random(),
          name: 'در حال بارگذاری...',
          size: 0,
          sizeFormatted: '',
          url: '',
          uploadDate: new Date().toLocaleDateString('fa-IR'),
          type: 'pdf',
          guid: info.fileGuid,
          isAgendaFile: true,
          agendaIndex: info.agendaIndex,
          agendaText: info.agendaText,
          isLoading: true,
          isLoaded: false
        }));

        this._agendaFiles.set(placeholders);

        try {
          const guids = agendaFilesInfo.map(x => x.fileGuid);
          const metas = await this.tusUploadService.getMetas(guids);

          const finalItems: FileItem[] = agendaFilesInfo.map((info, idx) => {
            const meta = metas.find((m: any) => m?.guid?.toLowerCase() === info.fileGuid.toLowerCase());
            const url = meta?.path ? this.tusUploadService.buildFileUrl(meta.path) : '';

            return {
              id: placeholders[idx].id,
              name: meta?.originalFileName || `فایل دستور ${info.agendaIndex}`,
              size: meta?.fileSize || 0,
              sizeFormatted: this.formatFileSize(meta?.fileSize || 0),
              url,
              uploadDate: '',
              type: 'pdf',
              guid: info.fileGuid,
              isAgendaFile: true,
              agendaIndex: info.agendaIndex,
              agendaText: info.agendaText,
              isLoading: false,
              isLoaded: !!url,
              error: url ? undefined : 'URL فایل یافت نشد'
            };
          });

          this._agendaFiles.set(finalItems);
        } catch (e) {
          console.error('Error loading agenda metas:', e);

          // fallback بدون meta
          this._agendaFiles.set(placeholders.map(p => ({
            ...p,
            isLoading: false,
            isLoaded: false,
            error: 'اطلاعات فایل یافت نشد'
          })));
        } finally {
          this._loadingAgendaFiles.set(false);
        }
      },
      error: (err) => {
        console.error('Error loading agendas:', err);
        this._agendaFiles.set([]);
        this._loadingAgendaFiles.set(false);
      }
    });
  }
  async selectAgendaFileForPreview(file: FileItem): Promise<void> {
    await this.selectFileForPreview(file);
  }

  async openAgendaFileInFullScreen(file: FileItem): Promise<void> {
    await this.openFileInFullScreen(file);
  }

  async downloadAgendaFile(file: FileItem): Promise<void> {
    await this.downloadFile(file);
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ لود فایل‌ها با استفاده از TUS - اصلاح شده
  // ═══════════════════════════════════════════════════════════

  async loadFilesForResolution(resolutionId: number): Promise<void> {
    if (this._loadingFiles().has(resolutionId)) return;

    this._loadingFiles.update(loading => new Set([...loading, resolutionId]));

    this.fileMeetingService.getFiles(resolutionId, 'Resolution').subscribe({
      next: async (files: any) => {

        if (!files || files.length === 0) {
          this._selectedResolutionFiles.update(filesMap => {
            const newMap = new Map(filesMap);
            newMap.set(resolutionId, []);
            return newMap;
          });
          this._loadingFiles.update(loading => {
            const newSet = new Set(loading);
            newSet.delete(resolutionId);
            return newSet;
          });
          return;
        }

        // ✅ ابتدا فایل‌ها را با اطلاعات اولیه نمایش بده
        const initialFiles: FileItem[] = files.map((file: any, index: number) => ({
          id: file.id || (Date.now() + index + Math.random()),
          name: file.fileName || `فایل ${index + 1}`,
          size: 0,
          sizeFormatted: '',
          url: '',
          uploadDate: new Date().toLocaleDateString('fa-IR'),
          type: 'pdf',
          guid: file.fileGuid || file.guid,
          isAgendaFile: false,
          isLoading: true,
          isLoaded: false
        }));

        this._selectedResolutionFiles.update(filesMap => {
          const newMap = new Map(filesMap);
          newMap.set(resolutionId, initialFiles);
          return newMap;
        });

        // ✅ جمع‌آوری GUID ها
        const guids = files
          .map((f: any) => f.fileGuid || f.guid)
          .filter((guid: string) => guid && guid !== '00000000-0000-0000-0000-000000000000');

        if (guids.length === 0) {
          this._loadingFiles.update(loading => {
            const newSet = new Set(loading);
            newSet.delete(resolutionId);
            return newSet;
          });
          return;
        }

        try {
          // ✅ گرفتن اطلاعات کامل از مدیریت فایل
          const metas = await this.tusUploadService.getMetas(guids);

          // ✅ آپدیت فایل‌ها با اطلاعات کامل
          const processedFiles: FileItem[] = files.map((file: any, index: number) => {
            const fileGuid = file.fileGuid || file.guid;
            const meta = metas.find((m: any) =>
              m?.guid?.toLowerCase() === fileGuid?.toLowerCase()
            );

            if (meta) {
              const url = meta.path
                ? this.tusUploadService.buildFileUrl(meta.path)
                : '';

              return {
                id: file.id || (Date.now() + index + Math.random()),
                name: meta.originalFileName || file.fileName || `فایل ${index + 1}`,
                size: meta.fileSize || 0,
                sizeFormatted: this.formatFileSize(meta.fileSize || 0),
                url: url,
                type: 'pdf',
                guid: fileGuid,
                isAgendaFile: false,
                isLoading: false,
                isLoaded: true
              };
            }

            // ✅ اگر meta پیدا نشد
            return {
              id: file.id || (Date.now() + index + Math.random()),
              name: file.fileName || `فایل ${index + 1}`,
              size: 0,
              sizeFormatted: '',
              url: '',
              uploadDate: new Date().toLocaleDateString('fa-IR'),
              type: 'pdf',
              guid: fileGuid,
              isAgendaFile: false,
              isLoading: false,
              isLoaded: false,
              error: 'اطلاعات فایل یافت نشد'
            };
          });

          this._selectedResolutionFiles.update(filesMap => {
            const newMap = new Map(filesMap);
            newMap.set(resolutionId, processedFiles);
            return newMap;
          });

        } catch (error) {
          console.error('Error loading file metas:', error);
          this.toastService.warning('برخی اطلاعات فایل‌ها بارگذاری نشد');

          // ✅ علامت‌گذاری همه به عنوان لود نشده
          this._selectedResolutionFiles.update(filesMap => {
            const newMap = new Map(filesMap);
            const currentFiles = newMap.get(resolutionId) || [];
            const updatedFiles = currentFiles.map(f => ({
              ...f,
              isLoading: false,
              isLoaded: false
            }));
            newMap.set(resolutionId, updatedFiles);
            return newMap;
          });
        } finally {
          this._loadingFiles.update(loading => {
            const newSet = new Set(loading);
            newSet.delete(resolutionId);
            return newSet;
          });
        }
      },
      error: (error) => {
        console.error('Error loading files for resolution:', error);
        this._loadingFiles.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(resolutionId);
          return newSet;
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ نمایش پیش‌نمایش فایل - اصلاح شده
  // ═══════════════════════════════════════════════════════════

  async selectFileForPreview(file: FileItem): Promise<void> {

    this._selectedFileForPreview.set(file);
    this._showFilePreview.set(true);
    this._isLoadingPreview.set(true);

    try {
      // ✅ اگر URL داریم، مستقیم استفاده کن
      if (file.url) {
        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(file.url);
        this._pdfUrl.set(safeUrl);
        this._isLoadingPreview.set(false);
        return;
      }

      // ✅ اگر URL نداریم، از مدیریت فایل بگیر
      const fileGuid = file.guid;
      if (!fileGuid) {
        throw new Error('GUID فایل یافت نشد');
      }

      const metas = await this.tusUploadService.getMetas([fileGuid]);
      const meta = metas[0];

      if (meta && meta.path) {
        const url = this.tusUploadService.buildFileUrl(meta.path);

        // ✅ آپدیت فایل در لیست با URL جدید
        this._selectedResolutionFiles.update(filesMap => {
          const newMap = new Map(filesMap);
          newMap.forEach((files, resId) => {
            const updatedFiles = files.map(f =>
              f.guid === fileGuid
                ? {
                  ...f,
                  url,
                  name: meta.originalFileName || f.name,
                  size: meta.fileSize || f.size,
                  sizeFormatted: this.formatFileSize(meta.fileSize || 0),
                  isLoaded: true
                }
                : f
            );
            newMap.set(resId, updatedFiles);
          });
          return newMap;
        });

        // ✅ آپدیت فایل انتخاب شده
        this._selectedFileForPreview.update(f => f ? { ...f, url } : null);

        const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this._pdfUrl.set(safeUrl);
      } else {
        throw new Error('URL فایل یافت نشد');
      }

    } catch (error) {
      console.error('Error loading preview:', error);
      this.toastService.error('خطا در بارگذاری پیش‌نمایش');
      this._pdfUrl.set(null);
    } finally {
      this._isLoadingPreview.set(false);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ باز کردن فایل در تمام صفحه - اصلاح شده
  // ═══════════════════════════════════════════════════════════

  async openFileInFullScreen(file: FileItem): Promise<void> {
    if (!file) {
      console.error('فایل معتبر نیست');
      return;
    }

    let fileUrl = file.url;

    // ✅ اگر URL نداریم، از مدیریت فایل بگیر
    if (!fileUrl && file.guid) {
      try {
        const metas = await this.tusUploadService.getMetas([file.guid]);
        const meta = metas[0];
        if (meta && meta.path) {
          fileUrl = this.tusUploadService.buildFileUrl(meta.path);

          // آپدیت فایل با URL جدید
          this._selectedResolutionFiles.update(filesMap => {
            const newMap = new Map(filesMap);
            newMap.forEach((files, resId) => {
              const updatedFiles = files.map(f =>
                f.guid === file.guid ? { ...f, url: fileUrl, isLoaded: true } : f
              );
              newMap.set(resId, updatedFiles);
            });
            return newMap;
          });
        }
      } catch (error) {
        console.error('Error getting file URL:', error);
      }
    }

    if (!fileUrl) {
      this.toastService.error('لینک فایل در دسترس نیست');
      return;
    }

    // ✅ باز کردن در پنجره جدید
    const newWindow = window.open('', '_blank', 'width=1200,height=800');

    if (!newWindow) {
      this.toastService.warning('مرورگر شما باز کردن پنجره جدید را مسدود کرده است');
      return;
    }

    try {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${file.name || 'فایل PDF'}</title>
          <meta charset="UTF-8">
          <style>
            body { 
              margin: 0; 
              padding: 0; 
              height: 100vh; 
              overflow: hidden; 
              background: #525659;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .loading {
              color: white;
              font-family: Tahoma, sans-serif;
              font-size: 18px;
            }
            embed, iframe { 
              width: 100%; 
              height: 100%; 
              border: none;
              display: block;
            }
          </style>
        </head>
        <body>
          <div class="loading" id="loading">در حال بارگذاری...</div>
          <embed id="pdfEmbed" style="display:none;" src="${fileUrl}#toolbar=1&navpanes=1&scrollbar=1" type="application/pdf">
          <script>
            window.onload = function() {
              const loading = document.getElementById('loading');
              const embed = document.getElementById('pdfEmbed');
              setTimeout(() => {
                if (embed) {
                  embed.style.display = 'block';
                  if (loading) loading.style.display = 'none';
                }
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      newWindow.document.close();
    } catch (error) {
      console.error('خطا در ایجاد محتوای پنجره:', error);
      newWindow.close();
      this.toastService.error('خطا در نمایش فایل');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ دانلود فایل - اصلاح شده
  // ═══════════════════════════════════════════════════════════

  async downloadFile(file: FileItem): Promise<void> {
    let downloadUrl = file.url;

    // ✅ اگر URL نداریم، از مدیریت فایل بگیر
    if (!downloadUrl && file.guid) {
      try {
        const metas = await this.tusUploadService.getMetas([file.guid]);
        const meta = metas[0];
        if (meta && meta.path) {
          downloadUrl = this.tusUploadService.buildFileUrl(meta.path);
        }
      } catch (error) {
        console.error('Error getting download URL:', error);
      }
    }

    if (!downloadUrl) {
      this.toastService.error('لینک دانلود یافت نشد');
      return;
    }

    // ✅ دانلود فایل
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.name || 'file.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastService.success('دانلود شروع شد');
  }


  // 3. اضافه کردن output signals جدید
  readonly showActionsReport = output<{ resolutionId?: number; assignmentId?: number; mode: ReportMode }>();

  // 4. اضافه کردن متدهای handler

  /**
   * نمایش گزارش اقدامات یک مصوبه
   */
  showResolutionReport(resolution: Resolution): void {
    this.showActionsReport.emit({
      resolutionId: resolution.id,
      mode: 'single-resolution'
    });
  }

  /**
   * نمایش گزارش اقدامات یک تخصیص
   */
  showAssignmentReport(assignmentId: number): void {
    this.showActionsReport.emit({
      assignmentId: assignmentId,
      mode: 'single-assignment'
    });
  }
  canShowActionsReport = input<boolean>(false);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. اضافه کردن signal برای نمایش/مخفی کردن banner راهنما:
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * ✅ جدید: کنترل نمایش banner راهنما
   */
  readonly showHelpBanner = signal<boolean>(true);


  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. اضافه کردن متد برای بستن راهنما:
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * بستن banner راهنما و ذخیره در localStorage
   */
  dismissHelpBanner(): void {
    this.showHelpBanner.set(false);
    localStorage.setItem('board-resolution-report-help-dismissed', 'true');
  }


  /**
   * نمایش گزارش کلی همه مصوبات
   */
  showAllResolutionsReport(): void {
    this.showActionsReport.emit({
      mode: 'all-resolutions'
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ Refresh فایل‌ها - اصلاح شده
  // ═══════════════════════════════════════════════════════════

  refreshFilesForResolution(resolutionId: number): void {
    this._selectedResolutionFiles.update(filesMap => {
      const newMap = new Map(filesMap);
      newMap.delete(resolutionId);
      return newMap;
    });

    this.loadFilesForResolution(resolutionId);
  }

  public refreshFiles(resolutionId: number): void {
    this.refreshFilesForResolution(resolutionId);
  }

  // ═══════════════════════════════════════════════════════════
  // سایر متدها (بدون تغییر یا با تغییرات جزئی)
  // ═══════════════════════════════════════════════════════════

  getFilesForResolution(resolutionId: number): FileItem[] {
    return this._selectedResolutionFiles().get(resolutionId) || [];
  }

  isLoadingFiles(resolutionId: number): boolean {
    return this._loadingFiles().has(resolutionId);
  }

  isDeletingFile(fileId: number): boolean {
    return this._deletingFiles().has(fileId);
  }

  isFileLoading(file: FileItem): boolean {
    return file.isLoading === true;
  }

  private formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  closeFilePreview(): void {
    this._selectedFileForPreview.set(null);
    this._showFilePreview.set(false);
    this._pdfUrl.set(null);
  }

  confirmDeleteFile(file: FileItem, resolutionId: number): void {
    if (!file.id) return;

    Swal.fire({
      title: 'حذف فایل پیوست',
      text: `آیا از حذف "${file.name}" اطمینان دارید؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف شود',
      cancelButtonText: 'خیر',
      reverseButtons: true
    }).then((result: { isConfirmed: any }) => {
      if (result.isConfirmed) {
        this._deletingFiles.update(deleting => new Set([...deleting, file.id!]));

        this.fileMeetingService.deleteFile(file.id).subscribe({
          next: () => {
            this._selectedResolutionFiles.update(filesMap => {
              const newMap = new Map(filesMap);
              const files = newMap.get(resolutionId) || [];
              const updatedFiles = files.filter(f => f.id !== file.id);
              newMap.set(resolutionId, updatedFiles);
              return newMap;
            });

            if (this._selectedFileForPreview()?.id === file.id) {
              this.closeFilePreview();
            }

            this._deletingFiles.update(deleting => {
              const newSet = new Set(deleting);
              newSet.delete(file.id!);
              return newSet;
            });

          },
          error: (error) => {
            console.error('Error deleting file:', error);
            this._deletingFiles.update(deleting => {
              const newSet = new Set(deleting);
              newSet.delete(file.id!);
              return newSet;
            });
            this.toastService.error('خطا در حذف فایل');
          }
        });
      }
    });
  }

  // ... سایر متدهای بدون تغییر ...

  printAllResolutionsClicked() {
    this.printAllResolutions.emit();
  }

  openDescriptionModal(html: string) {
    this.modalContent = html;
    this.modalRef = this.modalService.open(this.descriptionModal, { centered: true, size: 'lg' });
  }

  openDocumentationModal(html: string) {
    this.modalContent = html;
    this.modalRef = this.modalService.open(this.documentationModal, { centered: true, size: 'lg' });
  }

  closeModal() {
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  toggleResolutionExpanded(index: number) {
    this.expandedResolutionIndex = this.expandedResolutionIndex === index ? null : index;
  }

  onDrop(event: CdkDragDrop<Resolution[]>) {
    this.resolutionDropped.emit(event);
  }

  openAddResolutionModal() {
    this.addResolution.emit();
  }

  openEditResolutionModal(resolution: Resolution) {
    this.editResolution.emit(resolution);
  }

  deleteResolutionClicked(resolution: Resolution) {
    this.deleteResolution.emit(resolution);
  }

  assignResolutionClicked(resolution: Resolution) {
    this.assignResolution.emit(resolution);
  }

  showFilesClicked(resolutionId: number) {
    this.showFiles.emit(resolutionId);
  }

  printResolutionClicked(resolution: Resolution, index: number) {
    this.printResolution.emit({ resolution, index });
  }

  toggleCollapse(id: string) {
    const collapseElement = document.getElementById(`${id}`);
    if (collapseElement) {
      const bsCollapse = new Collapse(collapseElement, { toggle: false });
      const isCurrentlyOpen = collapseElement.classList.contains('show');

      this.collapseStates.update(states => {
        const newStates = new Map(states);
        newStates.set(id, !isCurrentlyOpen);
        return newStates;
      });

      if (isCurrentlyOpen) {
        bsCollapse.hide();
      } else {
        bsCollapse.show();
      }
    }
  }

  isCollapsed(id: string): boolean {
    return this.collapseStates().get(id) ?? false;
  }

  trackByFn(index: number, item: Resolution): any {
    return item.id ?? index;
  }

  editAssignmentClicked(assignId: number) {
    this.editAssignment.emit(assignId);
  }

  deleteAssignmentClicked(assign: any) {
    this.deleteAssignment.emit(assign);
  }

  getResolutionByIndex(index: number): Resolution | undefined {
    return this.resolutions()[index];
  }
}