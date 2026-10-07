import { escapeHtml } from '../print/template-engine';
import { MeetingStatuses } from './meeting-status';

/** نشان وضعیت جلسه برای سلول‌های ag-grid (رنگ‌ها از کلاس‌های mm-status-* در layout.css) */
export function meetingStatusBadge(statusId: number | null | undefined, title?: string | null): string {
  if (!statusId) return '';
  const text = title || MeetingStatuses.title(statusId);
  return `<span class="mm-status mm-status-${Number(statusId)}">${escapeHtml(text)}</span>`;
}
