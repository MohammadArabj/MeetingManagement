// tus-upload.service.ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import * as tus from 'tus-js-client';

import { environment } from '../../../environments/environment';
import { ACCESS_TOKEN_NAME } from '../../core/types/configuration';
import { getClientSettings } from './code-flow.service';

// ============================================
// Enums & Types
// ============================================
export enum UploadStatus {
  Pending = 0,
  Created = 1,
  InProgress = 2,
  Paused = 3,
  Completed = 4,
  Failed = 5,
  Cancelled = 6,
}

export interface FileItem {
  id: string;
  file: File | null;

  name: string;
  size: number;
  type: string;

  status: UploadStatus;
  progress: number;
  uploadedBytes: number;
  speed: number;
  remainingTime: number;
  errorMessage?: string;

  // Upload session
  sessionGuid?: string;
  tusFileId?: string;
  realTusFileId?: string;

  // Attachment
  fileGuid?: string;

  // Preview - حالا از path استفاده می‌کنیم
  previewUrl?: string;
  previewText?: string;
  isPreviewLoading?: boolean;

  // ✅ مسیر فایل روی سرور
  path?: string;

  tusUpload?: tus.Upload;
  startTime?: number;

  isExisting: boolean;
}

export interface UploadOptions {
  folderPath: string;
  description?: string;
  concurrency?: number;
  localPreview?: boolean;
}

type BackendResult<T> =
  | {
    isSuccess?: boolean;
    IsSuccess?: boolean;
    success?: boolean;
    Success?: boolean;
    succeeded?: boolean;
    Succeeded?: boolean;
    ok?: boolean;
    Ok?: boolean;
    data?: T;
    Data?: T;
    value?: T;
    Value?: T;
    result?: T;
    Result?: T;
    message?: string;
    Message?: string;
    errors?: any;
    Errors?: any;
  }
  | any;

interface InitiateUploadResult {
  sessionGuid: string;
  tusFileId: string;
  uploadUrl: string;
  expiresAt: string;
}

interface CompleteUploadResult {
  fileGuid: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  path?: string; // ✅ اضافه کردن path به نتیجه Complete
}

interface AttachmentMetaDto {
  guid: string;
  fileName: string;
  originalFileName?: string;
  contentType: string;
  fileSize: number;
  path: string;
}

// خروجی Bulk delete (بک‌اند)
export interface BulkDeleteAttachmentsResult {
  requested: number;
  deleted: number;
  deletedGuids: string[];
  notFoundGuids: string[];
  physicalDeleteFailedGuids: string[];
}

@Injectable({ providedIn: 'root' })
export class TusUploadService {
  private readonly http = inject(HttpClient);

  // ✅ Base URL برای فایل‌ها
  private readonly fileBaseUrl = environment.fileManagementEndpoint;
  private readonly uploadApiUrl = environment.fileManagementEndpoint + '/api/Upload';
  private readonly tusEndpoint = environment.fileManagementEndpoint + '/api/Upload/tus';
  private readonly attachmentUrl = environment.fileManagementEndpoint + '/api/Attachment';

  // ---------------------------
  // State
  // ---------------------------
  private readonly _files = signal<Map<string, FileItem>>(new Map());

  readonly filesMap = this._files.asReadonly();
  readonly files = computed(() => Array.from(this._files().values()));
  readonly totalFiles = computed(() => this.files().length);

  readonly existingFiles = computed(() => this.files().filter(f => f.isExisting));
  readonly newFiles = computed(() => this.files().filter(f => !f.isExisting));

  readonly pendingFiles = computed(() => this.files().filter(f => f.status === UploadStatus.Pending));
  readonly uploadingFiles = computed(() =>
    this.files().filter(f => f.status === UploadStatus.InProgress || f.status === UploadStatus.Created)
  );
  readonly pausedFiles = computed(() => this.files().filter(f => f.status === UploadStatus.Paused));
  readonly completedFiles = computed(() => this.files().filter(f => f.status === UploadStatus.Completed));
  readonly failedFiles = computed(() => this.files().filter(f => f.status === UploadStatus.Failed));
  readonly isUploading = computed(() => this.uploadingFiles().length > 0);

  readonly totalProgress = computed(() => {
    const uploading = this.uploadingFiles();
    if (!uploading.length) return 0;
    const total = uploading.reduce((sum, f) => sum + f.size, 0);
    const uploaded = uploading.reduce((sum, f) => sum + f.uploadedBytes, 0);
    return total > 0 ? Math.round((uploaded / total) * 100) : 0;
  });

  // ---------------------------
  // Events (optional)
  // ---------------------------
  private readonly _fileCompleted$ = new Subject<FileItem>();
  private readonly _fileFailed$ = new Subject<{ file: FileItem; error: string }>();
  private readonly _allCompleted$ = new Subject<FileItem[]>();

  readonly fileCompleted$ = this._fileCompleted$.asObservable();
  readonly fileFailed$ = this._fileFailed$.asObservable();
  readonly allCompleted$ = this._allCompleted$.asObservable();

  // ---------------------------
  // ObjectURL management (فقط برای فایل‌های لوکال)
  // ---------------------------
  private readonly objectUrlById = new Map<string, string>();

  // ---------------------------
  // Cache for metas
  // ---------------------------
  // آدرس فایل‌ها امضای موقت دارند (سامانه مدیریت فایل)؛ پس کش هم باید قبل از انقضای امضا خالی شود
  private readonly metaCache = new ExpiringCache<AttachmentMetaDto>(90 * 60 * 1000);

  // ---------------------------
  // serialize Initiate/Complete HTTP calls
  // ---------------------------
  private httpQueue: Promise<void> = Promise.resolve();
  private enqueueHttp<T>(task: () => Promise<T>): Promise<T> {
    const run = this.httpQueue.then(task, task);
    this.httpQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  // ============================================
  // ✅ Helper: ساخت URL کامل از path
  // ============================================
  buildFileUrl(path: string): string {
    if (!path) return '';

    // اگه path کامل هست (با http شروع میشه)
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // حذف slash اضافی
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${this.fileBaseUrl}/${cleanPath}`;
  }

  // ============================================
  // Add files (multi)
  // ============================================
  addFiles(
    fileList: FileList | File[],
    opts?: { maxFiles?: number; maxSizeMB?: number; acceptedTypes?: string[]; localPreview?: boolean }
  ): FileItem[] {
    const added: FileItem[] = [];
    const arr = Array.from(fileList || []);
    const localPreview = opts?.localPreview ?? true;

    for (const f of arr) {
      if (opts?.maxFiles && this.totalFiles() >= opts.maxFiles) break;
      if (opts?.maxSizeMB && f.size > opts.maxSizeMB * 1024 * 1024) continue;

      if (opts?.acceptedTypes?.length) {
        const ok = opts.acceptedTypes.some(t => this.accepts(f, (t || '').trim()));
        if (!ok) continue;
      }

      const id = this.createId();
      const item: FileItem = {
        id,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
        status: UploadStatus.Pending,
        progress: 0,
        uploadedBytes: 0,
        speed: 0,
        remainingTime: 0,
        isExisting: false,
      };

      // local preview برای فایل‌های جدید
      if (localPreview) {
        if (this.isPreviewableAsBlob(item.type)) {
          const url = URL.createObjectURL(f);
          this.objectUrlById.set(id, url);
          item.previewUrl = url;
        } else if (this.isText(item.type)) {
          if (f.size <= 512 * 1024) {
            f.text().then(txt => this.patch(id, { previewText: txt })).catch(() => void 0);
          }
        }
      }

      this.upsert(item);
      added.push(item);
    }

    return added;
  }

  private accepts(file: File, rule: string): boolean {
    if (!rule) return false;
    if (rule === '*') return true;
    if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule.toLowerCase());
    if (rule.endsWith('/*')) return (file.type || '').startsWith(rule.replace('/*', '/'));
    return (file.type || '') === rule;
  }

  private createId(): string {
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return `f_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  // ============================================
  // Load existing files (GetMetas)
  // ============================================
  async loadExistingFiles(guids: string[]): Promise<void> {
    const normalized = (guids || []).map(x => (x || '').trim().toLowerCase()).filter(Boolean);
    if (!normalized.length) return;

    // cache hit
    for (const g of normalized) {
      const cached = this.metaCache.get(g);
      if (cached) this.addExistingMetaToState(cached);
    }

    const missing = normalized.filter(g => !this.metaCache.has(g));
    if (!missing.length) return;

    const metas = await this.getMetas(missing);
    for (const m of metas) {
      if (!m?.guid) continue;
      const key = m.guid.toLowerCase();
      this.metaCache.set(key, m);
      this.addExistingMetaToState(m);
    }
  }

  // ✅ اصلاح شده - استفاده مستقیم از path برای previewUrl
  private addExistingMetaToState(m: AttachmentMetaDto): void {
    const id = (m.guid || '').trim();
    if (!id) return;

    if (this._files().has(id)) return;

    // ✅ ساخت URL کامل از path
    const fullPath = this.buildFileUrl(m.path);

    const item: FileItem = {
      id, // برای existing: id = guid
      file: null,
      name: m.originalFileName || m.fileName,
      size: m.fileSize,
      type: m.contentType,
      path: fullPath, // ✅ مسیر کامل
      previewUrl: fullPath, // ✅ مستقیم از path برای preview استفاده می‌کنیم
      status: UploadStatus.Completed,
      progress: 100,
      uploadedBytes: m.fileSize,
      speed: 0,
      remainingTime: 0,
      fileGuid: m.guid,
      isExisting: true,
    };

    this.upsert(item);
  }

  public async getMetas(guids: string[]): Promise<(AttachmentMetaDto | null)[]> {
    try {
      const res = await firstValueFrom(
        this.http.post<AttachmentMetaDto[]>(`${this.attachmentUrl}/GetMetas`, guids, this.authOptions())
      );
      const list = res || [];
      return guids.map(g => list.find(x => (x.guid || '').toLowerCase() === g.toLowerCase()) || null);
    } catch {
      return guids.map(() => null);
    }
  }

  // ============================================
  // Upload All (multi)
  // ============================================
  async uploadAll(options: UploadOptions): Promise<string[]> {
    const concurrency = Math.max(1, Math.min(6, options.concurrency ?? 3));
    const queue = this.pendingFiles().map(f => f.id);
    const results: string[] = [];

    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        if (!id) return;
        const guid = await this.uploadFile(id, options);
        if (guid) results.push(guid);
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker);
    await Promise.all(workers);

    if (!this.pendingFiles().length && !this.uploadingFiles().length) {
      this._allCompleted$.next(this.completedFiles());
    }

    return results;
  }

  // ============================================
  // Upload one file
  // ============================================
  async uploadFile(fileId: string, options: UploadOptions): Promise<string | null> {
    const file = this._files().get(fileId);
    if (!file || !file.file) return null;

    try {
      this.patch(fileId, { status: UploadStatus.Created, errorMessage: undefined });

      const init = await this.enqueueHttp(async () =>
        await firstValueFrom(
          this.http.post<BackendResult<InitiateUploadResult>>(
            `${this.uploadApiUrl}/Initiate`,
            {
              fileName: file.name,
              fileSize: file.size,
              contentType: file.type,
              clientId: getClientSettings()?.client_id ?? '',
              folderPath: options.folderPath,
              description: options.description,
            },
            this.authOptions()
          )
        )
      );

      const initOk = this.readOk(init);
      const initData = this.readPayload<InitiateUploadResult>(init);
      if (!initOk || !initData?.sessionGuid) throw new Error(this.readMessage(init) || 'خطا در شروع آپلود');

      this.patch(fileId, {
        sessionGuid: initData.sessionGuid,
        tusFileId: initData.tusFileId,
        startTime: Date.now(),
        status: UploadStatus.InProgress,
      });

      return await new Promise<string>((resolve, reject) => {
        const upload = new tus.Upload(file.file!, {
          endpoint: this.tusEndpoint,
          retryDelays: [0, 1000, 3000, 5000, 10000],
          chunkSize: 5 * 1024 * 1024,
          metadata: {
            filename: file.name,
            filetype: file.type,
            sessionId: initData.sessionGuid,
            folderPath: options.folderPath,
          },
          // توکن در هر درخواست (هر قطعه) تازه خوانده می‌شود؛ آپلود فایل‌های بزرگ ممکن است از عمر توکن طولانی‌تر باشد
          onBeforeRequest: (req) => {
            req.setHeader('Authorization', `Bearer ${this.getAccessToken()}`);
          },
          // قطعه‌ی ناموفق با خطای شبکه یا 5xx/423 دوباره ارسال می‌شود؛ 401/403 تکرار نمی‌شود
          onShouldRetry: (err) => {
            const status = (err as any)?.originalResponse?.getStatus?.() ?? 0;
            return status === 0 || status === 409 || status === 423 || status >= 500;
          },
          removeFingerprintOnSuccess: true,

          onError: (err) => {
            this.patch(fileId, { status: UploadStatus.Failed, errorMessage: err.message });
            const cur = this._files().get(fileId);
            if (cur) this._fileFailed$.next({ file: cur, error: err.message });
            reject(err);
          },

          onProgress: (bytesUploaded, bytesTotal) => {
            const cur = this._files().get(fileId);
            if (!cur) return;

            const progress = Math.round((bytesUploaded / bytesTotal) * 100);
            const elapsed = Math.max(0.001, (Date.now() - (cur.startTime || Date.now())) / 1000);
            const speed = bytesUploaded / elapsed;
            const remaining = speed > 0 ? (bytesTotal - bytesUploaded) / speed : 0;

            this.patch(fileId, {
              status: UploadStatus.InProgress,
              progress,
              uploadedBytes: bytesUploaded,
              speed,
              remainingTime: remaining,
            });
          },

          onSuccess: async () => {
            const realTusFileId = upload.url?.split('/').pop() || '';

            try {
              const complete = await this.enqueueHttp(async () =>
                await firstValueFrom(
                  this.http.post<BackendResult<CompleteUploadResult>>(
                    `${this.uploadApiUrl}/Complete`,
                    {
                      sessionGuid: initData.sessionGuid,
                      tusFileId: realTusFileId,
                      description: options.description,
                    },
                    this.authOptions()
                  )
                )
              );

              const ok = this.readOk(complete);
              const data = this.readPayload<CompleteUploadResult>(complete);
              if (!ok || !data?.fileGuid) throw new Error(this.readMessage(complete) || 'خطا در تکمیل آپلود');

              // ✅ اگه path از Complete برگشت، ازش استفاده کن
              const filePath = data.path ? this.buildFileUrl(data.path) : undefined;

              this.patch(fileId, {
                status: UploadStatus.Completed,
                progress: 100,
                uploadedBytes: file.size,
                realTusFileId,
                fileGuid: data.fileGuid,
                path: filePath,
                // ✅ اگه path داریم، previewUrl رو آپدیت کن (برای فایل‌های جدید آپلود شده)
                ...(filePath && this.isPreviewableAsBlob(file.type) ? { previewUrl: filePath } : {}),
              });

              const cur = this._files().get(fileId);
              if (cur) this._fileCompleted$.next(cur);

              resolve(data.fileGuid);
            } catch (e: any) {
              this.patch(fileId, { status: UploadStatus.Failed, errorMessage: e?.message || 'خطا' });
              const cur = this._files().get(fileId);
              if (cur) this._fileFailed$.next({ file: cur, error: e?.message || 'خطا' });
              reject(e);
            }
          },
        });

        this.patch(fileId, { tusUpload: upload });

        upload.findPreviousUploads().then(prev => {
          if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
          upload.start();
        });
      });
    } catch (e: any) {
      this.patch(fileId, { status: UploadStatus.Failed, errorMessage: e?.message || 'خطا' });
      const cur = this._files().get(fileId);
      if (cur) this._fileFailed$.next({ file: cur, error: e?.message || 'خطا' });
      return null;
    }
  }

  // ============================================
  // Pause/Resume
  // ============================================
  pauseUpload(id: string): void {
    const f = this._files().get(id);
    if (f?.tusUpload && f.status === UploadStatus.InProgress) {
      f.tusUpload.abort();
      this.patch(id, { status: UploadStatus.Paused });
    }
  }

  resumeUpload(id: string): void {
    const f = this._files().get(id);
    if (f?.tusUpload && f.status === UploadStatus.Paused) {
      f.tusUpload.start();
      this.patch(id, { status: UploadStatus.InProgress });
    }
  }
  // ============================================
  // Detached upload (بدون ورود به state فهرست فایل‌ها؛ برای لوگو، قالب چاپ و ...)
  // ============================================
  /** آپلود یک فایل با tus بدون تأثیر بر فهرست فایل‌های در حال نمایش؛ خروجی: شناسه فایل */
  async uploadDetached(file: File, folderPath: string, description?: string): Promise<string> {
    const init = await firstValueFrom(
      this.http.post<BackendResult<InitiateUploadResult>>(
        `${this.uploadApiUrl}/Initiate`,
        {
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || 'application/octet-stream',
          clientId: getClientSettings()?.client_id ?? '',
          folderPath,
          description,
        },
        this.authOptions()
      )
    );
    const initData = this.readPayload<InitiateUploadResult>(init);
    if (!this.readOk(init) || !initData?.sessionGuid) throw new Error(this.readMessage(init) || 'خطا در شروع آپلود');

    const tusFileId = await new Promise<string>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: this.tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 5 * 1024 * 1024,
        metadata: {
          filename: file.name,
          filetype: file.type || 'application/octet-stream',
          sessionId: initData.sessionGuid,
          folderPath,
        },
        onBeforeRequest: (req) => {
          req.setHeader('Authorization', `Bearer ${this.getAccessToken()}`);
        },
        onShouldRetry: (err) => {
          const status = (err as any)?.originalResponse?.getStatus?.() ?? 0;
          return status === 0 || status === 409 || status === 423 || status >= 500;
        },
        removeFingerprintOnSuccess: true,
        onError: (err) => reject(err),
        onSuccess: () => resolve(upload.url?.split('/').pop() || ''),
      });
      upload.start();
    });

    const complete = await firstValueFrom(
      this.http.post<BackendResult<CompleteUploadResult>>(
        `${this.uploadApiUrl}/Complete`,
        { sessionGuid: initData.sessionGuid, tusFileId, description },
        this.authOptions()
      )
    );
    const data = this.readPayload<CompleteUploadResult>(complete);
    if (!this.readOk(complete) || !data?.fileGuid) throw new Error(this.readMessage(complete) || 'خطا در تکمیل آپلود');

    if (data.path) {
      this.metaCache.set(data.fileGuid.toLowerCase(), {
        guid: data.fileGuid,
        fileName: data.fileName,
        contentType: data.contentType,
        fileSize: data.fileSize,
        path: data.path,
      });
    }
    return data.fileGuid;
  }

  /** محتوای یک فایل (با احراز هویت)؛ در صورت نبود یا خطا null */
  async downloadBlob(guid: string): Promise<Blob | null> {
    const normalized = (guid || '').trim();
    return normalized ? this.fetchPreviewBlob(normalized) : null;
  }

  // tus-upload.service.ts

  // ============================================
  // ✅ Public method برای گرفتن URL پیش‌نمایش با GUID
  // ============================================
  async getFilePreviewUrl(guid: string): Promise<string | null> {
    const normalized = (guid || '').trim().toLowerCase();
    if (!normalized) return null;

    // اول چک کن توی cache هست یا نه
    const cached = this.metaCache.get(normalized);
    if (cached) {
      return this.buildFileUrl(cached.path);
    }

    // از سرور بگیر
    try {
      const metas = await this.getMetas([normalized]);
      const meta = metas[0];
      if (meta?.path) {
        this.metaCache.set(normalized, meta);
        return this.buildFileUrl(meta.path);
      }
    } catch (e) {
      console.warn('Failed to get file preview URL:', e);
    }

    return null;
  }

  // ============================================
  // ✅ Batch method برای گرفتن چند URL با هم
  // ============================================
  async getFilePreviewUrls(guids: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const normalized = (guids || [])
      .map(x => (x || '').trim().toLowerCase())
      .filter(Boolean);

    if (!normalized.length) return result;

    // اول از cache بخون
    const missing: string[] = [];
    for (const g of normalized) {
      const cached = this.metaCache.get(g);
      if (cached?.path) {
        result.set(g, this.buildFileUrl(cached.path));
      } else {
        missing.push(g);
      }
    }

    // بقیه رو از سرور بگیر
    if (missing.length > 0) {
      try {
        const metas = await this.getMetas(missing);
        for (let i = 0; i < missing.length; i++) {
          const meta = metas[i];
          if (meta?.path) {
            const url = this.buildFileUrl(meta.path);
            result.set(missing[i], url);
            this.metaCache.set(missing[i], meta);
          }
        }
      } catch (e) {
        console.warn('Failed to get file preview URLs:', e);
      }
    }

    return result;
  }
  // ============================================
  // ✅ Preview - اصلاح شده (استفاده از path)
  // ============================================
  async ensurePreview(id: string): Promise<void> {
    const f = this._files().get(id);
    if (!f) return;

    // اگه قبلاً previewUrl داریم، کاری نکن
    if (f.previewUrl) return;

    // اگه previewText داریم (برای فایل‌های متنی)، کاری نکن
    if (f.previewText) return;

    // اگه در حال لود هست، کاری نکن
    if (f.isPreviewLoading) return;

    // ✅ اگه path داریم، مستقیم ازش استفاده کن
    if (f.path && this.isPreviewableAsBlob(f.type)) {
      this.patch(id, { previewUrl: f.path });
      return;
    }

    // برای فایل‌های متنی، اگه path داریم fetch کن
    if (f.path && this.isText(f.type)) {
      this.patch(id, { isPreviewLoading: true });
      try {
        const response = await fetch(f.path);
        if (response.ok) {
          const text = await response.text();
          this.patch(id, { previewText: text });
        }
      } catch (e) {
        console.error('Error loading text preview:', e);
      } finally {
        this.patch(id, { isPreviewLoading: false });
      }
      return;
    }

    // ✅ Fallback: اگه path نداریم، از API استفاده کن (برای backward compatibility)
    const guid = (f.fileGuid || (f.isExisting ? f.id : ''))?.trim();
    if (!guid) return;

    this.patch(id, { isPreviewLoading: true });

    try {
      if (this.isText(f.type)) {
        const blob = await this.fetchPreviewBlob(guid);
        if (blob) {
          const text = await blob.text();
          this.patch(id, { previewText: text });
        }
      } else if (this.isPreviewableAsBlob(f.type)) {
        const blob = await this.fetchPreviewBlob(guid);
        if (blob) {
          const url = URL.createObjectURL(blob);
          this.revokeObjectUrl(id);
          this.objectUrlById.set(id, url);
          this.patch(id, { previewUrl: url });
        }
      }
    } finally {
      this.patch(id, { isPreviewLoading: false });
    }
  }

  private async fetchPreviewBlob(guid: string): Promise<Blob | null> {
    try {
      return await firstValueFrom(
        this.http.get(`${this.attachmentUrl}/Preview/${guid}`, {
          responseType: 'blob',
          headers: this.authHeaders(),
          withCredentials: true,
        })
      );
    } catch {
      return null;
    }
  }

  // ============================================
  // Download (auth)
  // ============================================
  async downloadWithAuth(guid: string, suggestedName?: string): Promise<void> {
    // ✅ اول چک کن آیا path مستقیم داریم
    const file = this.findFileByGuid(guid);
    if (file?.path) {
      // دانلود مستقیم از path
      this.downloadFromUrl(file.path, suggestedName || file.name);
      return;
    }

    // Fallback به API
    const token = this.getAccessToken();
    const url = `${this.attachmentUrl}/Download/${guid}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });

    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const filename = this.extractFilenameFromResponse(response) || suggestedName || 'download';
    const blob = await response.blob();

    const blobUrl = URL.createObjectURL(blob);
    this.downloadFromUrl(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }

  // ✅ Helper برای دانلود از URL
  private downloadFromUrl(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ✅ Helper برای پیدا کردن فایل با guid
  private findFileByGuid(guid: string): FileItem | null {
    const g = (guid || '').trim().toLowerCase();
    for (const f of this._files().values()) {
      if ((f.fileGuid || '').toLowerCase() === g || f.id.toLowerCase() === g) {
        return f;
      }
    }
    return null;
  }

  private extractFilenameFromResponse(response: Response): string | null {
    const cd = response.headers.get('content-disposition');
    if (!cd) return null;

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(cd);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].trim());

    const quotedMatch = /filename="([^"]+)"/i.exec(cd);
    if (quotedMatch?.[1]) return quotedMatch[1].trim();

    const plainMatch = /filename=([^;]+)/i.exec(cd);
    if (plainMatch?.[1]) return plainMatch[1].trim();

    return null;
  }

  // ============================================
  // DELETE (Bulk Only)
  // ============================================
  async deleteAttachments(guids: string[]): Promise<{ ok: boolean; result?: BulkDeleteAttachmentsResult; message?: string }> {
    const distinct = Array.from(
      new Set((guids || []).map(x => (x || '').trim().toLowerCase()).filter(Boolean))
    );

    if (!distinct.length) return { ok: false, message: 'لیست شناسه‌ها خالی است' };

    const bulk = await this.tryBulkDelete(distinct);

    const deleted = bulk.result?.deletedGuids || [];
    for (const g of deleted) {
      this.metaCache.delete(g.toLowerCase());
      const id = this._files().has(g) ? g : this.findByGuid(g);
      if (id) this.removeFile(id);
    }

    return bulk;
  }

  async deleteAttachment(guid: string): Promise<boolean> {
    const g = (guid || '').trim();
    if (!g) return false;

    const res = await this.deleteAttachments([g]);
    return (res.result?.deletedGuids || []).some(x => x.toLowerCase() === g.toLowerCase());
  }

  private async tryBulkDelete(guids: string[]): Promise<{ ok: boolean; result?: BulkDeleteAttachmentsResult; message?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.post<BackendResult<BulkDeleteAttachmentsResult>>(
          `${this.attachmentUrl}/Delete`,
          guids,
          this.authOptions()
        )
      );

      const okFlag = this.readOk(res);
      const payload = this.readPayload<BulkDeleteAttachmentsResult>(res);
      const normalized = payload ? this.normalizeBulk(payload) : undefined;

      const ok = okFlag === true || ((normalized?.deleted || 0) > 0);

      return { ok, result: normalized, message: this.readMessage(res) };
    } catch (e: any) {
      return { ok: false, message: e?.message };
    }
  }

  private normalizeBulk(x: any): BulkDeleteAttachmentsResult {
    const requested = Number(x?.requested ?? x?.Requested ?? 0);
    const deleted = Number(x?.deleted ?? x?.Deleted ?? 0);
    const deletedGuids = (x?.deletedGuids ?? x?.DeletedGuids ?? []) as string[];
    const notFoundGuids = (x?.notFoundGuids ?? x?.NotFoundGuids ?? []) as string[];
    const physicalDeleteFailedGuids = (x?.physicalDeleteFailedGuids ?? x?.PhysicalDeleteFailedGuids ?? []) as string[];

    return {
      requested,
      deleted,
      deletedGuids: (deletedGuids || []).map(s => (s || '').trim().toLowerCase()).filter(Boolean),
      notFoundGuids: (notFoundGuids || []).map(s => (s || '').trim().toLowerCase()).filter(Boolean),
      physicalDeleteFailedGuids: (physicalDeleteFailedGuids || []).map(s => (s || '').trim().toLowerCase()).filter(Boolean),
    };
  }

  private findByGuid(guid: string): string | null {
    const g = (guid || '').trim().toLowerCase();
    for (const f of this._files().values()) {
      if ((f.fileGuid || '').toLowerCase() === g) return f.id;
    }
    return null;
  }

  // ============================================
  // Remove / Clear
  // ============================================
  removeFile(id: string): void {
    const f = this._files().get(id);
    if (!f) return;

    if (f.tusUpload) f.tusUpload.abort();
    this.revokeObjectUrl(id);

    this._files.update(map => {
      const m = new Map(map);
      m.delete(id);
      return m;
    });
  }

  clearAll(): void {
    const ids = Array.from(this._files().keys());
    for (const id of ids) this.removeFile(id);
    this._files.set(new Map());
  }

  // ============================================
  // Helpers: state
  // ============================================
  private upsert(item: FileItem): void {
    this._files.update(map => {
      const m = new Map(map);
      m.set(item.id, item);
      return m;
    });
  }

  private patch(id: string, partial: Partial<FileItem>): void {
    const cur = this._files().get(id);
    if (!cur) return;
    this.upsert({ ...cur, ...partial });
  }

  private revokeObjectUrl(id: string): void {
    const url = this.objectUrlById.get(id);
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    this.objectUrlById.delete(id);
  }

  // ============================================
  // Helpers: auth
  // ============================================
  private authHeaders(token = this.getAccessToken()): HttpHeaders {
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private authOptions(): { headers: HttpHeaders; withCredentials: boolean } {
    return { headers: this.authHeaders(), withCredentials: true };
  }

  private getAccessToken(): string {
    const direct = localStorage.getItem(ACCESS_TOKEN_NAME) ?? '';
    const fallback = sessionStorage.getItem(ACCESS_TOKEN_NAME) ?? '';
    const legacy =
      localStorage.getItem('accessToken') ||
      sessionStorage.getItem('accessToken') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      '';
    return direct || fallback || legacy;
  }

  // ============================================
  // Helpers: response readers
  // ============================================
  private readOk(r: any): boolean {
    if (!r) return false;
    const v =
      r.isSuccess ?? r.IsSuccess ??
      r.success ?? r.Success ??
      r.succeeded ?? r.Succeeded ??
      r.ok ?? r.Ok;
    return v === true;
  }

  private readPayload<T>(r: any): T | undefined {
    if (!r) return undefined;
    return (r.data ?? r.Data ?? r.value ?? r.Value ?? r.result ?? r.Result) as T | undefined;
  }

  private readMessage(r: any): string | undefined {
    if (!r) return undefined;
    return (r.message ?? r.Message) as string | undefined;
  }

  // ============================================
  // Helpers: file types
  // ============================================
  isImage(type: string): boolean { return !!type && type.startsWith('image/'); }
  isPdf(type: string): boolean { return type === 'application/pdf'; }
  isAudio(type: string): boolean { return !!type && type.startsWith('audio/'); }
  isVideo(type: string): boolean { return !!type && type.startsWith('video/'); }
  isText(type: string): boolean {
    return !!type && (type.startsWith('text/') || type.includes('json') || type.includes('xml'));
  }

  private isPreviewableAsBlob(type: string): boolean {
    return this.isImage(type) || this.isPdf(type) || this.isAudio(type) || this.isVideo(type);
  }
}

/** کش ساده با زمان انقضا (برای متادیتای فایل‌ها که آدرس امضاشده‌ی موقت دارند) */
class ExpiringCache<T> {
  private readonly items = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expiresAt < Date.now()) {
      this.items.delete(key);
      return undefined;
    }
    return item.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  set(key: string, value: T): void {
    this.items.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): boolean {
    return this.items.delete(key);
  }

  clear(): void {
    this.items.clear();
  }
}
