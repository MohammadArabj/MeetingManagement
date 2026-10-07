import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { ToastService } from '../../../../../services/framework-services/toast.service';
import { FileMeetingService } from '../../../../../services/file-meeting.service';
import { AgendaService } from '../../../../../services/agenda.service';
import { TusUploadService, UploadStatus } from '../../../../../services/framework-services/tus-upload.service';

import { EMPTY_GUID, FileItem, ResolutionFileDto } from './resolution-form.models';
import { buildFilesArray, extractAgendaFilesInfo, formatFileSize, revokeBlobUrls } from './resolution-form.utils';

/**
 * وضعیت و منطق فایل‌های فرم مصوبه (فایل‌های دستور جلسه، فایل‌های مصوبه، آپلود TUS و پیش‌نمایش PDF).
 * این سرویس در سطح ResolutionFormComponent ارائه می‌شود (هر نمونه فرم، نمونه مستقل خودش را دارد).
 */
@Injectable()
export class ResolutionFilesStore {
  // ═══════════════════════════════════════════════════════════
  // DI
  // ═══════════════════════════════════════════════════════════
  private readonly toast = inject(ToastService);
  private readonly fileMeetingService = inject(FileMeetingService);
  private readonly agendaService = inject(AgendaService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tus = inject(TusUploadService);

  // ═══════════════════════════════════════════════════════════
  // State (Signals)
  // ═══════════════════════════════════════════════════════════
  readonly _resolutionFiles = signal<FileItem[]>([]);
  private readonly _agendaFiles = signal<FileItem[]>([]);

  private readonly _selectedFileId = signal<number | null>(null);
  private readonly _pdfUrl = signal<SafeResourceUrl | null>(null);

  private readonly _loadingAgendaFiles = signal<boolean>(false);
  private readonly _isUploading = signal<boolean>(false);
  private readonly _uploadProgress = signal<number>(0);

  private readonly _agendas = signal<any[]>([]);

  private _agendaLoadSeq = 0;

  // ═══════════════════════════════════════════════════════════
  // Readonly
  // ═══════════════════════════════════════════════════════════
  readonly selectedFileId = this._selectedFileId.asReadonly();
  readonly pdfUrl = this._pdfUrl.asReadonly();

  readonly loadingAgendaFiles = this._loadingAgendaFiles.asReadonly();
  readonly isUploading = this._isUploading.asReadonly();
  readonly uploadProgress = this._uploadProgress.asReadonly();

  readonly agendas = this._agendas.asReadonly();

  // ═══════════════════════════════════════════════════════════
  // Computeds
  // ═══════════════════════════════════════════════════════════
  readonly agendaFiles = computed(() => this._agendaFiles().filter(f => !f.isRemoved && f.type !== 'loading'));
  readonly resolutionFiles = computed(() => this._resolutionFiles().filter(f => !f.isRemoved && f.type !== 'loading'));

  readonly hasAgendaFiles = computed(() => this.agendaFiles().length > 0);
  readonly fileCount = computed(() => this.agendaFiles().length + this.resolutionFiles().length);
  readonly allFiles = computed(() => [...this.agendaFiles(), ...this.resolutionFiles()]);

  hasRemovedFiles(): boolean {
    return this._resolutionFiles().some(f => f.isRemoved === true);
  }

  /** آیا لیست خام فایل‌های دستور جلسه (شامل ردیف loading) خالی است؟ */
  hasNoAgendaEntries(): boolean {
    return this._agendaFiles().length === 0;
  }

  // ═══════════════════════════════════════════════════════════
  // Agenda Loading
  // ═══════════════════════════════════════════════════════════
  loadAgendaFiles(meetingGuid: any): void {
    if (!meetingGuid) return;

    const seq = ++this._agendaLoadSeq;
    this._loadingAgendaFiles.set(true);

    this._agendaFiles.set([
      {
        id: -1,
        name: 'در حال بارگذاری فایل‌های دستور جلسه...',
        url: '',
        type: 'loading',
        scope: 'agenda',
      },
    ]);

    this.agendaService.getListBy(meetingGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: any[]) => {
          if (seq !== this._agendaLoadSeq) return;

          const agendas = data || [];
          this._agendas.set(agendas);

          const agendaFilesInfo = extractAgendaFilesInfo(agendas);

          if (agendaFilesInfo.length === 0) {
            this._agendaFiles.set([]);
            this._loadingAgendaFiles.set(false);
            return;
          }

          const fileGuids = agendaFilesInfo.map(x => x.fileGuid);

          this.tus.getMetas(fileGuids)
            .then((metas: any[]) => {
              if (seq !== this._agendaLoadSeq) return;

              const items: FileItem[] = agendaFilesInfo.map((info, idx) => {
                const meta = metas.find((m: any) => m?.guid?.toLowerCase() === info.fileGuid.toLowerCase());
                const previewUrl = meta?.path ? this.tus.buildFileUrl(meta.path) : '';

                return {
                  id: Number(`${Date.now()}${idx}`),
                  name: meta?.originalFileName || `فایل دستور ${info.agendaIndex}`,
                  url: previewUrl,
                  type: 'pdf',
                  scope: 'agenda',

                  size: meta?.fileSize || 0,
                  sizeFormatted: formatFileSize(meta?.fileSize || 0),
                  uploadDate: meta?.createdAt
                    ? new Date(meta.createdAt).toLocaleDateString('fa-IR')
                    : new Date().toLocaleDateString('fa-IR'),

                  guid: info.fileGuid,
                  fileGuid: info.fileGuid,
                  isLazyLoaded: !previewUrl,

                  agendaText: info.agendaText,
                  agendaIndex: info.agendaIndex,
                };
              });

              this._agendaFiles.set(items);
            })
            .catch(err => {
              console.error('Error loading agenda metas:', err);
              if (seq !== this._agendaLoadSeq) return;

              const fallback: FileItem[] = agendaFilesInfo.map((info, idx) => ({
                id: Number(`${Date.now()}${idx}`),
                name: `فایل دستور ${info.agendaIndex}`,
                url: '',
                type: 'pdf',
                scope: 'agenda',

                guid: info.fileGuid,
                fileGuid: info.fileGuid,
                isLazyLoaded: true,

                agendaText: info.agendaText,
                agendaIndex: info.agendaIndex,
              }));

              this._agendaFiles.set(fallback);
            })
            .finally(() => {
              if (seq === this._agendaLoadSeq) this._loadingAgendaFiles.set(false);
            });
        },
        error: (err) => {
          console.error('Error loading agendas:', err);
          if (seq !== this._agendaLoadSeq) return;
          this._agendaFiles.set([]);
          this._loadingAgendaFiles.set(false);
          this.toast.error('خطا در بارگذاری فایل‌های دستور جلسه');
        },
      });
  }

  private async loadAgendaFileOnDemand(file: FileItem): Promise<void> {
    const fileGuid = file.guid || file.fileGuid;
    if (!fileGuid) {
      this.toast.error('شناسه فایل یافت نشد');
      return;
    }

    if (file.url && !file.isLazyLoaded) {
      this.showPdfPreview(file.url, file.name);
      return;
    }

    this.toast.info('در حال بارگذاری فایل...');

    try {
      const metas = await this.tus.getMetas([fileGuid]);
      const meta = metas?.[0];

      if (!meta?.path) {
        this.toast.error('فایل یافت نشد');
        return;
      }

      const url = this.tus.buildFileUrl(meta.path);

      this._agendaFiles.update(list =>
        list.map(f => f.id === file.id
          ? {
            ...f,
            url,
            name: meta.originalFileName || f.name,
            size: meta.fileSize || f.size,
            sizeFormatted: formatFileSize(meta.fileSize || 0),
            isLazyLoaded: false,
          }
          : f
        )
      );

      this.showPdfPreview(url, meta.originalFileName || file.name);
    } catch (e) {
      console.error('Error loading agenda file on demand:', e);
      this.toast.error('خطا در بارگذاری فایل');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Resolution files (TUS)
  // ═══════════════════════════════════════════════════════════
  /** getFolderPath هنگام شروع آپلود هر فایل خوانده می‌شود */
  async processFiles(files: File[], getFolderPath: () => string): Promise<void> {
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    const invalid = files.filter(f => f.type !== 'application/pdf');

    if (invalid.length) this.toast.error('فقط فایل‌های PDF پذیرفته می‌شوند');

    for (const f of pdfFiles) {
      await this.uploadFileWithTus(f, getFolderPath);
    }
  }

  private async uploadFileWithTus(file: File, getFolderPath: () => string): Promise<void> {
    const localId = Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
    const localUrl = URL.createObjectURL(file);

    const localItem: FileItem = {
      id: localId,
      name: file.name,
      url: localUrl,
      type: 'pdf',
      scope: 'resolution',

      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      uploadDate: new Date().toLocaleDateString('fa-IR'),

      isUploading: true,
      uploadProgress: 0,

      isBlobUrl: true,
    };

    this._resolutionFiles.update(cur => [...cur, localItem]);
    this._isUploading.set(true);

    try {
      const added = this.tus.addFiles([file], {
        maxSizeMB: 50,
        acceptedTypes: ['application/pdf'],
        localPreview: false,
      });

      if (!added.length) throw new Error('فایل به صف آپلود اضافه نشد');

      const tusItem = added[0];

      const progressTimer = setInterval(() => {
        const current = this.tus.filesMap().get(tusItem.id);
        if (!current) return;

        this._resolutionFiles.update(list =>
          list.map(x => x.id === localId
            ? { ...x, uploadProgress: current.progress }
            : x
          )
        );

        if (current.status === UploadStatus.Completed || current.status === UploadStatus.Failed) {
          clearInterval(progressTimer);
        }
      }, 100);

      const guid = await this.tus.uploadFile(tusItem.id, {
        folderPath: getFolderPath(),
        description: 'فایل مصوبه',
      });

      clearInterval(progressTimer);

      if (!guid) throw new Error('آپلود ناموفق بود');

      this._resolutionFiles.update(list =>
        list.map(x => x.id === localId
          ? { ...x, fileGuid: guid, isUploading: false, uploadProgress: 100 }
          : x
        )
      );

      this.toast.success('فایل با موفقیت آپلود شد');

    } catch (e: any) {
      console.error('Error uploading file:', e);

      const item = this._resolutionFiles().find(x => x.id === localId);
      if (item?.isBlobUrl && item.url?.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }

      this._resolutionFiles.update(list => list.filter(x => x.id !== localId));
      this.toast.error(`خطا در آپلود فایل: ${e?.message || 'نامشخص'}`);

    } finally {
      const stillUploading = this._resolutionFiles().some(x => x.isUploading);
      this._isUploading.set(stillUploading);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PDF Preview
  // ═══════════════════════════════════════════════════════════
  showPdfPreview(url: string, name: string): void {
    const pdfPanel = document.getElementById('pdfPanel');
    const mainContainer = document.getElementById('mainContainer');

    this._pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));

    const title = document.getElementById('pdf-title');
    if (title) title.innerHTML = name;

    pdfPanel?.classList.remove('hidden');
    mainContainer?.classList.remove('no-pdf');
  }

  hidePdfPreview(): void {
    const pdfPanel = document.getElementById('pdfPanel');
    const mainContainer = document.getElementById('mainContainer');

    this._pdfUrl.set(null);
    pdfPanel?.classList.add('hidden');
    mainContainer?.classList.add('no-pdf');
    this._selectedFileId.set(null);
  }

  // ═══════════════════════════════════════════════════════════
  // Select file
  // ═══════════════════════════════════════════════════════════
  selectFile(fileId: number): void {
    this._selectedFileId.set(fileId);

    const a = this._agendaFiles().find(x => x.id === fileId);
    if (a) {
      if (a.type === 'loading') return;
      if (a.isLazyLoaded || !a.url) {
        this.loadAgendaFileOnDemand(a);
      } else {
        this.showPdfPreview(a.url, a.name);
      }
      return;
    }

    const r = this._resolutionFiles().find(x => x.id === fileId);
    if (!r) return;

    if (r.url) this.showPdfPreview(r.url, r.name);
  }

  // ═══════════════════════════════════════════════════════════
  // Existing resolution files (edit)
  // ═══════════════════════════════════════════════════════════
  loadExistingResolutionFiles(resolutionId: any): void {
    if (!resolutionId) return;

    this._resolutionFiles.set([
      {
        id: -2,
        name: 'در حال بارگذاری فایل‌ها...',
        url: '',
        type: 'loading',
        scope: 'resolution',
      },
    ]);

    this.fileMeetingService.getFiles(resolutionId, 'Resolution')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (files: any) => {
          this._resolutionFiles.update(cur => cur.filter(x => x.id !== -2));

          if (!files?.length) return;

          const fileGuids = files
            .map((f: any) => f.fileGuid)
            .filter((g: string) => g && g !== EMPTY_GUID);

          if (!fileGuids.length) return;

          this.tus.getMetas(fileGuids)
            .then((metas: any[]) => {
              const processed: FileItem[] = files.map((f: any, idx: number) => {
                const meta = metas.find((m: any) => m?.guid?.toLowerCase() === f.fileGuid?.toLowerCase());
                const previewUrl = meta?.path ? this.tus.buildFileUrl(meta.path) : '';

                return {
                  id: f.id || Number(`${Date.now()}${idx}`),
                  name: meta?.originalFileName || meta?.name || `فایل ${idx + 1}`,
                  url: previewUrl,
                  type: 'pdf',
                  scope: 'resolution',

                  size: meta?.fileSize || 0,
                  sizeFormatted: formatFileSize(meta?.fileSize || 0),
                  uploadDate: meta?.createdAt
                    ? new Date(meta.createdAt).toLocaleDateString('fa-IR')
                    : new Date().toLocaleDateString('fa-IR'),

                  guid: f.fileGuid,
                  fileGuid: f.fileGuid,
                  isLazyLoaded: !previewUrl,
                  isRemoved: false,
                };
              });

              this._resolutionFiles.update(cur => [...cur, ...processed]);
            })
            .catch(err => {
              console.error('Error loading file metas:', err);
              this.toast.warning('برخی اطلاعات فایل‌ها بارگذاری نشد');

              const fallback: FileItem[] = files.map((f: any, idx: number) => ({
                id: f.id || Number(`${Date.now()}${idx}`),
                name: `فایل ${idx + 1}`,
                url: '',
                type: 'pdf',
                scope: 'resolution',
                guid: f.fileGuid,
                fileGuid: f.fileGuid,
                isLazyLoaded: true,
                isRemoved: false,
              }));

              this._resolutionFiles.update(cur => [...cur, ...fallback]);
            });
        },
        error: (err) => {
          console.error('Error loading existing files:', err);
          this._resolutionFiles.update(cur => cur.filter(x => x.id !== -2));
          this.toast.error('خطا در بارگذاری فایل‌ها');
        },
      });
  }

  // ═══════════════════════════════════════════════════════════
  // Files (save / delete / restore / cleanup)
  // ═══════════════════════════════════════════════════════════
  buildFilesArray(): ResolutionFileDto[] {
    return buildFilesArray(this._resolutionFiles());
  }

  async deleteFile(fileId: number): Promise<void> {
    const file = this._resolutionFiles().find(x => x.id === fileId);
    if (!file) return;

    if (!confirm('آیا از حذف این فایل اطمینان دارید؟')) return;

    if (file.isBlobUrl && file.url?.startsWith('blob:')) {
      URL.revokeObjectURL(file.url);
    }

    if (file.fileGuid && !file.guid) {
      try {
        await this.tus.deleteAttachment(file.fileGuid);
        this.toast.success('فایل حذف شد');
      } catch (e) {
        console.warn('Failed to delete new file:', e);
        this.toast.warning('فایل از لیست حذف شد');
      }

      this._resolutionFiles.update(list => list.filter(x => x.id !== fileId));
    } else if (file.guid) {
      this._resolutionFiles.update(list =>
        list.map(x => x.id === fileId ? { ...x, isRemoved: true } : x)
      );
      this.toast.info('فایل برای حذف علامت‌گذاری شد. با ذخیره مصوبه، حذف نهایی می‌شود.');
    }

    if (this._selectedFileId() === fileId) {
      this.hidePdfPreview();
    }
  }

  restoreFile(fileId: number): void {
    this._resolutionFiles.update(list =>
      list.map(x => x.id === fileId ? { ...x, isRemoved: false } : x)
    );
    this.toast.success('فایل بازگردانی شد');
  }

  /** GUID فایل‌هایی که در همین فرم آپلود شده‌اند و هنوز ذخیره نشده‌اند */
  private newUploadedGuids(): string[] {
    return this._resolutionFiles()
      .filter(f => !f.guid && !!f.fileGuid && !f.isRemoved)
      .map(x => x.fileGuid!);
  }

  /** حذف فایل‌های آپلودشده‌ی ذخیره‌نشده هنگام لغو فرم */
  async deleteNewUploadsOnCancel(): Promise<void> {
    const guids = this.newUploadedGuids();

    if (guids.length > 0) {
      try {
        await this.tus.deleteAttachments(guids);
        console.log(`Deleted ${guids.length} uploaded files on cancel`);
      } catch (e) {
        console.warn('Failed to delete uploaded files on cancel:', e);
      }
    }
  }

  async cleanupUnusedFiles(): Promise<void> {
    const guids = this.newUploadedGuids();

    if (guids.length === 0) return;

    try {
      await this.tus.deleteAttachments(guids);
      console.log(`Cleanup: Deleted ${guids.length} unused uploaded files`);
    } catch (e) {
      console.warn('Cleanup failed:', e);
    }

    revokeBlobUrls(this._resolutionFiles());
  }

  /** پاک‌سازی فایل‌های مصوبه و وضعیت پیش‌نمایش (فایل‌های دستور جلسه حفظ می‌شوند) */
  reset(): void {
    revokeBlobUrls(this._resolutionFiles());

    this._resolutionFiles.set([]);
    this._selectedFileId.set(null);
    this._pdfUrl.set(null);
    this._uploadProgress.set(0);
  }
}
