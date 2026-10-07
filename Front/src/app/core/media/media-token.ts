import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * توکن کوتاه‌مدت نمایش عکس‌های پرسنلی (سامانه‌ی مدیریت فایل).
 * ─────────────────────────────────────────────────────────────────────────
 * عکس‌ها دیگر بدون ورود قابل دریافت نیستند؛ تگ img هم هدر Authorization نمی‌فرستد. بنابراین یک توکن
 * (mt) از  GET api/Media/Token  گرفته و به آدرس عکس اضافه می‌شود. توکن برای همه‌ی کاربران در یک ساعت
 * یکسان است؛ آدرس عکس‌ها ثابت می‌ماند و مرورگر آن‌ها را از کش می‌دهد. توکن در localStorage نگه داشته
 * می‌شود تا پس از Refresh صفحه، عکس‌ها بی‌درنگ (بدون انتظار درخواست) نمایش داده شوند.
 */

const STORAGE_KEY = 'mm.media.token';
const REFRESH_MARGIN_MS = 60 * 60 * 1000; // یک ساعت پیش از انقضا تمدید شود

interface StoredToken { token: string; expiresAt: number; }

let current: StoredToken | null = readStored();

/** «&mt=…» برای افزودن به آدرس عکس (یا رشته‌ی خالی اگر هنوز توکنی نیست) */
export function mediaTokenParam(): string {
  return current && current.expiresAt > Date.now() ? `&mt=${encodeURIComponent(current.token)}` : '';
}

/** آدرس عکس پرسنلی بهینه‌شده (WebP/JPEG، کش‌شده). width = عرض نمایشی؛ برای صفحه‌های HiDPI دو برابر گرفته می‌شود */
export function userPhotoUrl(userName: string | null | undefined, width = 48): string {
  if (!userName) return '';
  const w = Math.min(512, Math.round(width * 2));
  return `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${userName}.jpg`)}&w=${w}${mediaTokenParam()}`;
}

/** آدرس کامل تصویر امضا از مسیر امضاشده‌ای که سرور مدیریت جلسات برگردانده است */
export function signatureImageUrl(relative: string | null | undefined): string {
  if (!relative) return '';
  return /^https?:\/\//i.test(relative) ? relative : `${environment.fileManagementEndpoint}${relative.startsWith('/') ? '' : '/'}${relative}`;
}

@Injectable({ providedIn: 'root' })
export class MediaTokenService {
  private readonly auth = inject(AuthService);
  private inflight: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** اطمینان از وجود توکن معتبر (در شروع برنامه؛ حداکثر ۲.۵ ثانیه انتظار، هرگز خطا نمی‌دهد) */
  async ensure(): Promise<void> {
    if (current && current.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
      this.schedule();
      return;
    }
    const fetchTask = this.refresh();
    // اگر توکن قبلی هنوز معتبر است، منتظر درخواست نمی‌مانیم
    if (current && current.expiresAt > Date.now()) return;
    await Promise.race([fetchTask, new Promise<void>(r => setTimeout(r, 2500))]);
  }

  refresh(): Promise<void> {
    this.inflight ??= this.fetchToken().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async fetchToken(): Promise<void> {
    const accessToken = this.auth.accessToken();
    if (!accessToken) return;
    try {
      const res = await fetch(`${environment.fileManagementEndpoint}/api/Media/Token`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const body = await res.json() as { token?: string; expiresAt?: string };
      const expiresAt = body.expiresAt ? Date.parse(body.expiresAt) : NaN;
      if (!body.token || Number.isNaN(expiresAt)) return;
      current = { token: body.token, expiresAt };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* حالت خصوصی مرورگر */ }
    } catch {
      // سامانه‌ی مدیریت فایل در دسترس نیست؛ عکس‌ها آواتار پیش‌فرض نشان می‌دهند
    } finally {
      this.schedule();
    }
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    const due = current ? Math.max(60_000, current.expiresAt - Date.now() - REFRESH_MARGIN_MS) : 5 * 60_000;
    this.timer = setTimeout(() => void this.refresh(), Math.min(due, 2_147_000_000));
  }
}

function readStored(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    return parsed?.token && parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}
