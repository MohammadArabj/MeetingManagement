import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpService, RequestConfig } from '../../services/framework-services/http.service';
import { getServiceUrl } from '../../../environments/environment';
import { MeetingCapability, MeetingRoleKey, MeetingRoles, RoleConfig, RoleDefinition } from './meeting-roles';

export interface MeetingAccess {
  exists: boolean;
  meetingGuid: string;
  statusId: number;
  kind: 'Regular' | 'Board' | 'Committee';
  roleId: number | null;
  roleKey: MeetingRoleKey;
  roleTitle: string | null;
  capabilities: MeetingCapability[];
  isSuperAdmin: boolean;
  isCreator: boolean;
  isSubstitute: boolean;
  isGlobalViewer: boolean;
  chairmanSigned: boolean;
  isContentEditable: boolean;
  canEditResolutions: boolean;
  canManageAssignments: boolean;
  workflowSteps: number[];
  hasAttendance: boolean;
  hasMinutes: boolean;
}

/**
 * دسترسی کاربر جاری روی جلسه (منبع حقیقت: سرور — IMeetingAccessService).
 * کامپوننت‌های جدید به‌جای محاسبه با roleId از can() استفاده کنند:
 *    access.can('ManageResolutions')
 */
@Injectable({ providedIn: 'root' })
export class MeetingAccessService {
  private readonly http = inject(HttpService);
  private readonly baseUrl = `${getServiceUrl()}MeetingAccess`;

  private readonly _access = signal<MeetingAccess | null>(null);
  private readonly _roleConfig = signal<RoleConfig | null>(null);

  readonly access = this._access.asReadonly();
  readonly roleConfig = this._roleConfig.asReadonly();
  readonly capabilities = computed(() => new Set(this._access()?.capabilities ?? []));
  readonly isBoard = computed(() => this._access()?.kind === 'Board');

  can(capability: MeetingCapability): boolean {
    const a = this._access();
    return !!a && (a.isSuperAdmin || this.capabilities().has(capability));
  }

  /** بارگذاری دسترسی برای یک جلسه (در صفحه جزئیات جلسه فراخوانی شود) */
  async load(meetingGuid: string): Promise<MeetingAccess | null> {
    if (!meetingGuid) return null;
    try {
      const access = await firstValueFrom(
        this.http.get<MeetingAccess>(`${this.baseUrl}/${meetingGuid}`, '', new RequestConfig({ noValidate: true, loading: false })));
      this._access.set(access);
      return access;
    } catch {
      this._access.set(null);
      return null;
    }
  }

  clear(): void { this._access.set(null); }

  /** پیکربندی نقش‌ها (در شروع برنامه) */
  async loadRoleConfig(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.http.get<RoleConfig>(`${this.baseUrl}/RoleConfig`, '', new RequestConfig({ noValidate: true, loading: false })));
      this._roleConfig.set(config);
      MeetingRoles.load(config?.roles);
    } catch {
      // سرور قدیمی/در دسترس نبودن: پیش‌فرض‌ها استفاده می‌شوند
    }
  }

  saveRoleConfig(roles: RoleDefinition[]) {
    return this.http.post<boolean>(`${this.baseUrl}/RoleConfig`, roles, new RequestConfig({ noValidate: true }));
  }

  resetRole(roleId: number) {
    return this.http.post<boolean>(`${this.baseUrl}/RoleConfig/Reset/${roleId}`, {}, new RequestConfig({ noValidate: true }));
  }
}
