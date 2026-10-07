import { environment } from '../../../environments/environment';
import { ACCESS_TOKEN_NAME } from '../types/configuration';

/**
 * توکن کوتاه‌مدت نمایش عکس‌های پرسنلی سامانه‌ی مدیریت فایل.
 * عکس‌ها دیگر بدون ورود در دسترس نیستند و تگ img هدر Authorization نمی‌فرستد؛ پس توکن (mt) از
 * GET api/Media/Token گرفته و به آدرس عکس افزوده می‌شود. توکن در localStorage نگه داشته می‌شود.
 */
const STORAGE_KEY = 'um.media.token';
const REFRESH_MARGIN_MS = 60 * 60 * 1000;

interface StoredToken { token: string; expiresAt: number; }

let inflight: Promise<string> | null = null;

function readStored(): StoredToken | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as StoredToken | null;
    return parsed?.token && parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

function accessToken(): string {
  return localStorage.getItem(ACCESS_TOKEN_NAME) || sessionStorage.getItem(ACCESS_TOKEN_NAME) || '';
}

/** توکن معتبر (از حافظه یا با یک درخواست)؛ در صورت خطا رشته‌ی خالی */
export async function getMediaToken(): Promise<string> {
  const stored = readStored();
  if (stored && stored.expiresAt - Date.now() > REFRESH_MARGIN_MS) return stored.token;

  inflight ??= (async () => {
    try {
      const token = accessToken();
      if (!token) return stored?.token ?? '';
      const res = await fetch(`${environment.fileManagementEndpoint}/api/Media/Token`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) return stored?.token ?? '';
      const body = await res.json() as { token?: string; expiresAt?: string };
      const expiresAt = body.expiresAt ? Date.parse(body.expiresAt) : NaN;
      if (!body.token || Number.isNaN(expiresAt)) return stored?.token ?? '';
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: body.token, expiresAt })); } catch { /* ignore */ }
      return body.token;
    } catch {
      return stored?.token ?? '';
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** آدرس عکس پرسنلی (بندانگشتی WebP/JPEG کش‌شده) */
export async function userPhotoUrl(userName: string, width = 48): Promise<string> {
  if (!userName) return '';
  const token = await getMediaToken();
  const w = Math.min(512, Math.round(width * 2));
  return `${environment.fileManagementEndpoint}/photo/${encodeURIComponent(userName)}.jpg?w=${w}${token ? `&mt=${encodeURIComponent(token)}` : ''}`;
}
