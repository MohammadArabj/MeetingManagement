import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ServiceBase } from './framework-services/service.base';
import { RequestConfig } from './framework-services/http.service';

// ═══════════════════════════════════════════════════════════════════════════
//  مدل‌ها (هم‌نام با NotificationAdminService سمت سرور)
// ═══════════════════════════════════════════════════════════════════════════
export interface NotificationTemplate {
  id: number;
  title: string;
  content: string;
  eventCode: string;
  inUse: boolean;
}

export interface NotificationEvent {
  code: string;
  codeValue: number;
  eventId: number;
  title: string;
  group: string;
  isScheduled: boolean;
  defaultRecipients: string[];
  settingId: number | null;
  isSmsEnabled: boolean;
  isNotificationEnabled: boolean;
  sendToAllParticipants: boolean;
  supportsAllParticipants: boolean;
  templateId: number | null;
  templateContent: string | null;
  defaultTemplate: string;
  templates: NotificationTemplate[];
  sentLast30Days: number;
  failedLast30Days: number;
}

export interface UpdateEventSetting {
  code: string;
  isSmsEnabled: boolean;
  isNotificationEnabled: boolean;
  sendToAllParticipants: boolean;
  templateId: number | null;
}

export interface SaveTemplate {
  id?: number | null;
  eventCode: string;
  title: string;
  content: string;
  setActive: boolean;
}

export interface TemplatePreview {
  rendered: string;
  length: number;
  smsParts: number;
  unknownPlaceholders: string[];
}

export type LogStatus = 'pending' | 'retry' | 'sent' | 'failed' | 'skipped';

export interface NotificationLogSearch {
  page: number;
  pageSize: number;
  status?: LogStatus | null;
  eventCode?: string | null;
  receiver?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface NotificationLogItem {
  id: number;
  eventTitle: string;
  channel: 'sms' | 'inapp';
  receiver: string;
  message: string;
  status: LogStatus;
  attempts: number;
  sentAt: string;
  errorMessage: string | null;
}

export interface NotificationLogPage {
  items: NotificationLogItem[];
  total: number;
  statusCounts: Partial<Record<LogStatus, number>>;
}

export interface AlarmItem {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  expireAt: string | null;
}

export interface AlarmList { items: AlarmItem[]; unread: number; }

const NV = () => new RequestConfig({ noValidate: true });
const SILENT = () => new RequestConfig({ noValidate: true, loading: false });

/** API های «تنظیمات › اطلاع‌رسانی» و زنگوله اعلان‌ها */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService extends ServiceBase {
  private readonly alarmUrl = this.baseUrl.replace(/NotificationCenter$/, 'Alarm');

  constructor() {
    super('NotificationCenter');
  }

  getEvents(): Observable<NotificationEvent[]> {
    return this.httpService.get<NotificationEvent[]>(`${this.baseUrl}/Events`);
  }

  updateEvent(model: UpdateEventSetting): Observable<boolean> {
    return this.httpService.post<boolean>(`${this.baseUrl}/Events/Update`, model, NV(), false);
  }

  getPlaceholders(): Observable<Record<string, string>> {
    return this.httpService.get<Record<string, string>>(`${this.baseUrl}/Placeholders`);
  }

  saveTemplate(model: SaveTemplate): Observable<number> {
    return this.httpService.post<number>(`${this.baseUrl}/Templates/Save`, model, NV());
  }

  deleteTemplate(id: number): Observable<boolean> {
    return this.httpService.post<boolean>(`${this.baseUrl}/Templates/Delete/${id}`, {}, NV());
  }

  preview(content: string): Observable<TemplatePreview> {
    return this.httpService.post<TemplatePreview>(`${this.baseUrl}/Templates/Preview`, { content }, SILENT(), false);
  }

  searchLogs(search: NotificationLogSearch): Observable<NotificationLogPage> {
    return this.httpService.post<NotificationLogPage>(`${this.baseUrl}/Logs`, search, NV(), false);
  }

  resend(id: number): Observable<boolean> {
    return this.httpService.post<boolean>(`${this.baseUrl}/Logs/Resend/${id}`, {}, NV());
  }

  testSms(mobile: string, text: string): Observable<boolean> {
    return this.httpService.post<boolean>(`${this.baseUrl}/TestSms`, { mobile, text }, NV(), false);
  }

  // ── زنگوله ─────────────────────────────────────────────
  myAlarms(onlyUnread = false, take = 20): Observable<AlarmList> {
    return this.httpService.getWithParams<AlarmList>(`${this.alarmUrl}/Mine`, { onlyUnread, take }, SILENT());
  }

  markRead(id: number): Observable<boolean> {
    return this.httpService.post<boolean>(`${this.alarmUrl}/MarkRead/${id}`, {}, SILENT(), false);
  }

  markAllRead(): Observable<boolean> {
    return this.httpService.post<boolean>(`${this.alarmUrl}/MarkAllRead`, {}, SILENT(), false);
  }
}
