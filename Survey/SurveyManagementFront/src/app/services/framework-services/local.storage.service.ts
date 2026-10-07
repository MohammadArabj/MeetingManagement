import { Injectable } from '@angular/core';
import * as config from '../../core/types/configuration';
export const ROLE_CONTEXT = 'survey.role-context.v1';
export const DELEGATION_ID = 'survey.delegation-id';
export const EFFECTIVE_USER_ID = 'survey.effective-user-id';
const authKeys = new Set<string>([
  config.ACCESS_TOKEN_NAME, config.ROLE_TOKEN_NAME, config.PERMISSIONS_NAME,
  config.USER_ID_NAME, config.POSITION_ID, config.POSITION_NAME, config.IsDeletage,
  config.Main_USER_ID, config.ISSP, config.USER_CURRENT_ACTIVE_SESSION_NAME,
  config.USER_COMPANY_ID_NAME, config.USER_ORGANIZATION_CHART_ID_NAME,
  config.USER_CLASSIFICATION_LEVEL_ID_NAME, config.USER_SESSION_STORAGE_TOKEN,
  config.IS_IMPERSONATING, config.ADMIN_USER_ID, config.ADMIN_POSITION_ID,
  config.ADMIN_POSITION_NAME, config.ADMIN_PERMISSIONS, config.ADMIN_MAIN_USER_ID,
  config.ADMIN_IS_DELEGATE, config.IMPERSONATED_USER_NAME, config.IMPERSONATED_USER_GUID,
  config.IMPERSONATED_POSITION_NAME, DELEGATION_ID, EFFECTIVE_USER_ID, ROLE_CONTEXT
]);
@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  constructor() {
    // Do not migrate old unverified authentication/permission values.
    for (const key of authKeys) localStorage.removeItem(key);
  }
  private context(): Record<string, string> {
    try { return JSON.parse(sessionStorage.getItem(ROLE_CONTEXT) ?? '{}') ?? {}; }
    catch { return {}; }
  }
  getItem(name: string): string {
    const value = this.context()[name];
    if (typeof value === 'string') return value;
    return (authKeys.has(name) ? sessionStorage : localStorage).getItem(name) ?? '';
  }
  setItem(name: string, value: string): void {
    const context = this.context();
    if (Object.prototype.hasOwnProperty.call(context, name)) {
      context[name] = value;
      sessionStorage.setItem(ROLE_CONTEXT, JSON.stringify(context));
    } else (authKeys.has(name) ? sessionStorage : localStorage).setItem(name, value);
  }
  exists(name: string): boolean { return this.getItem(name) !== ''; }
  removeItem(name: string): void {
    const context = this.context();
    if (Object.prototype.hasOwnProperty.call(context, name)) {
      delete context[name];
      sessionStorage.setItem(ROLE_CONTEXT, JSON.stringify(context));
    }
    (authKeys.has(name) ? sessionStorage : localStorage).removeItem(name);
    localStorage.removeItem(name);
  }
  commitRole(values: Record<string, string>): void {
    // A single write: quota/error cannot leave half of a role change committed.
    sessionStorage.setItem(ROLE_CONTEXT, JSON.stringify(values));
  }
  clearRole(): void { sessionStorage.removeItem(ROLE_CONTEXT); }
}
