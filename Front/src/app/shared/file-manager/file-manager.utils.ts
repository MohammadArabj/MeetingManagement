import { FileItem, UploadStatus } from '../../services/framework-services/tus-upload.service';
import { FileKind } from './file-manager.models';

/** حداقل امکانات لازم برای تشخیص نوع فایل (TusUploadService این را پیاده می‌کند) */
export interface FileTypeChecker {
  isImage(type: string): boolean;
  isPdf(type: string): boolean;
  isVideo(type: string): boolean;
  isAudio(type: string): boolean;
  isText(type: string): boolean;
}

export function getFileKind(file: FileItem | null | undefined, checker: FileTypeChecker): FileKind {
  if (!file?.type) return 'other';
  if (checker.isImage(file.type)) return 'image';
  if (checker.isPdf(file.type)) return 'pdf';
  if (checker.isVideo(file.type)) return 'video';
  if (checker.isAudio(file.type)) return 'audio';
  if (checker.isText(file.type)) return 'text';
  return 'other';
}

const FILE_ICON_MAP: Record<FileKind, string> = {
  image: 'fa-image',
  pdf: 'fa-file-pdf',
  video: 'fa-video',
  audio: 'fa-music',
  text: 'fa-file-alt',
  other: 'fa-file',
};

export function getFileIconClass(kind: FileKind): string {
  return FILE_ICON_MAP[kind] || 'fa-file';
}

const STATUS_CLASS_MAP: Record<UploadStatus, string> = {
  [UploadStatus.Pending]: 'status-badge--pending',
  [UploadStatus.InProgress]: 'status-badge--uploading',
  [UploadStatus.Completed]: 'status-badge--completed',
  [UploadStatus.Failed]: 'status-badge--failed',
  [UploadStatus.Paused]: 'status-badge--paused',
  [UploadStatus.Created]: 'status-badge--uploading',
  [UploadStatus.Cancelled]: 'status-badge--failed',
};

export function getStatusClass(status: UploadStatus): string {
  return STATUS_CLASS_MAP[status] || '';
}

export function getStatusText(status: UploadStatus, progress: number): string {
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

export function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatSpeed(bps: number): string {
  return `${formatSize(bps)}/s`;
}

export function normGuid(g: string): string {
  return (g || '').trim().toLowerCase();
}

/**
 * نسخه‌ی کوچک‌شده‌ی تصویر از سامانه‌ی مدیریت فایل (WebP/JPEG، کش‌شده روی سرور و مرورگر).
 * فقط برای آدرس‌های امضاشده‌ی /files/…؛ پیش‌نمایش محلی (blob:) دست‌نخورده برمی‌گردد.
 */
export function thumbnailUrl(url: string | null | undefined, width: number): string {
  if (!url) return '';
  if (!/\/files\/[^?]+\?[^#]*\bsig=/.test(url)) return url;
  return `${url}&w=${Math.round(width)}`;
}
