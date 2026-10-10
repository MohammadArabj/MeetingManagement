/**
 * برنامه مانند مدیریت جلسات با مسیرهای hash (#/...) کار می‌کند.
 * لینک‌های قبلی نظرسنجی بدون # بودند (مثلاً http://host/survey/take/{guid} یا /survey-auth?u=..&k=..)
 * و در QR کدها و پیام‌ها پخش شده‌اند؛ این تابع آن‌ها را بدون بارگذاری مجدد به #/... منتقل می‌کند.
 * آدرس بازگشت از SSO (/challenge?code=..) قبلاً در AuthService.init پردازش و پاک شده است.
 */
export function migratePathRouteToHash(): void {
  const { pathname, search, hash } = window.location;
  if (hash && hash !== '#' && hash !== '#/') return;

  const base = (document.querySelector('base')?.getAttribute('href') ?? '/').replace(/\/?$/, '/');
  let path = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '');
  path = path.replace(/^index\.html$/i, '');
  if (!path || /^challenge\/?$/i.test(path)) return;
  // فقط مسیرهای برنامه (نه فایل‌ها)
  if (/\.[a-z0-9]{2,5}$/i.test(path)) return;

  window.history.replaceState(null, '', `${base}#/${path}${search}`);
}
