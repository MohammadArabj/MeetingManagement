import { environment } from '../../../environments/environment';

/**
 * ریشه‌های API که توکن دریافت می‌کنند (Survey، UserManagement، FileManagement).
 * ✅ قبلاً «return true» موقت باعث می‌شد توکن به هر آدرسی (حتی سایت‌های خارجی) ارسال شود.
 * تطبیق با origin و مرز مسیر انجام می‌شود تا «https://api.x/api-evil» با «https://api.x/api» یکی نشود.
 */
export const AUTH_API_ROOTS: readonly string[] = [
  environment.getServiceUrl(),
  environment.getUserManagementUrl(),
  environment.getFileManagementUrl(),
].filter((x): x is string => !!x);

export function isTrustedApi(url: string, base: string = window.location.href, roots = AUTH_API_ROOTS): boolean {
  try {
    const target = new URL(url, base);
    return roots.some(root => {
      const allowed = new URL(root, base);
      const path = allowed.pathname.replace(/\/+$/, '');
      return target.origin === allowed.origin &&
        (target.pathname === path || target.pathname.startsWith(path + '/'));
    });
  } catch { return false; }
}
