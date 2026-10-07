export function safeReturnUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/dashboard';
  const path = value.split(/[?#]/)[0];
  if (/^\/(challenge|silent-renew|auth-error|survey-auth)(\/|$)/i.test(path)) return '/dashboard';
  return value;
}
export function normalizePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) return [...new Set(raw.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(Boolean))];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try { const value: unknown = JSON.parse(raw); if (Array.isArray(value)) return normalizePermissions(value); } catch { /* Legacy CSV */ }
  return [...new Set(raw.split(',').map(v => v.trim().replace(/^"|"$/g, '')).filter(Boolean))];
}
export function errorKind(error: unknown): string {
  const e = error as { status?: number; name?: string; message?: string };
  if (e?.message === 'session') return 'session';
  if (e?.message === 'access' || e?.status === 403) return 'access';
  if (e?.status === 401) return 'unauthorized';
  if (e?.status === 409) return 'configuration';
  if (e?.message === 'profile') return 'profile';
  return 'service';
}
