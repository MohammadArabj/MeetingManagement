import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  LogStatus, NotificationCenterService, NotificationEvent, NotificationLogItem, NotificationLogPage, NotificationLogSearch,
} from '../../../services/notification-center.service';

const STATUS_META: Record<LogStatus, { title: string; css: string }> = {
  pending: { title: 'در صف', css: 'bg-secondary' },
  retry: { title: 'تلاش مجدد', css: 'bg-warning text-dark' },
  sent: { title: 'ارسال شده', css: 'bg-success' },
  failed: { title: 'ناموفق', css: 'bg-danger' },
  skipped: { title: 'نادیده', css: 'bg-light text-dark border' },
};

/** گزارش ارسال پیامک‌ها با فیلتر، صفحه‌بندی و ارسال مجدد */
@Component({
  selector: 'app-notification-logs',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-logs.component.html',
  styles: [`
    :host { display: block; }
    .status-filter .btn { font-size: .8rem; }
    .msg { max-width: 380px; }
    td { vertical-align: middle; }
  `],
})
export class NotificationLogsComponent implements OnInit {
  private readonly api = inject(NotificationCenterService);

  protected readonly statusMeta = STATUS_META;
  protected readonly statuses = Object.keys(STATUS_META) as LogStatus[];

  readonly loading = signal(false);
  readonly events = signal<NotificationEvent[]>([]);
  readonly page = signal<NotificationLogPage>({ items: [], total: 0, statusCounts: {} });
  readonly search = signal<NotificationLogSearch>({ page: 1, pageSize: 20, status: null, eventCode: null, receiver: '' });
  readonly expandedId = signal<number | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.page().total / this.search().pageSize)));

  async ngOnInit(): Promise<void> {
    firstValueFrom(this.api.getEvents()).then(e => this.events.set(e ?? [])).catch(() => {});
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.page.set(await firstValueFrom(this.api.searchLogs(this.search())));
    } catch {
      this.page.set({ items: [], total: 0, statusCounts: {} });
    } finally {
      this.loading.set(false);
    }
  }

  apply(patch: Partial<NotificationLogSearch>): void {
    this.search.update(s => ({ ...s, ...patch, page: patch.page ?? 1 }));
    void this.load();
  }

  async resend(item: NotificationLogItem): Promise<void> {
    try {
      await firstValueFrom(this.api.resend(item.id));
      await this.load();
    } catch { /* پیام نمایش داده شده */ }
  }

  toggle(id: number): void {
    this.expandedId.update(x => x === id ? null : id);
  }

  formatDate(value: string): string {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
    } catch {
      return value;
    }
  }
}
