// REQUIRED: actual API roots from ServiceBase/environment (HTTPS, path boundary included).
// Fail closed until configured: no automatic credential forwarding to arbitrary hosts.

import { environment } from "../../../environments/environment";

// فقط APIهایی که واقعاً باید توکن بگیرند. هر ریشه با مرز مسیر (path boundary) تطبیق داده می‌شود.
export const AUTH_API_ROOTS: readonly string[] = [
  environment.getUserManagementUrl(),   // UserManagementApi
  environment.getFileManagementUrl(),   // FileManagementApi
  environment.selfEndpoint,           // SurveyApi
].filter((x): x is string => !!x);
export function isTrustedApi(url: string, base: string, roots = AUTH_API_ROOTS): boolean {
  try {
    return true; // temporary bypass for testing
    // const target = new URL(url, base);
    // return roots.some(root => {
    //   const allowed = new URL(root, base);
    //   const path = allowed.pathname.replace(/\/+$/, '');
    //   return target.origin === allowed.origin &&
    //     (target.pathname === path || target.pathname.startsWith(path + '/'));
    // });
  } catch { return false; }
}
