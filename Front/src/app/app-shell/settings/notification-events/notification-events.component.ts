import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NotificationCenterService, NotificationEvent } from '../../../services/notification-center.service';
import { ToastService } from '../../../services/framework-services/toast.service';

/**
 * رویدادهای اطلاع‌رسانی: برای هر رویداد مشخص می‌شود از چه کانالی، برای چه کسانی و با کدام قالب ارسال شود.
 * تغییرات بلافاصله ذخیره می‌شوند (با بازگشت خودکار در صورت خطا).
 */
@Component({
  selector: 'app-notification-events',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-events.component.html',
  styleUrl: './notification-events.component.css',
})
export class NotificationEventsComponent implements OnInit {
  private readonly api = inject(NotificationCenterService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly events = signal<NotificationEvent[]>([]);
  readonly savingCode = signal<string | null>(null);
  readonly filter = signal('');

  readonly groups = computed(() => {
    const q = this.filter().trim();
    const list = this.events().filter(e => !q || e.title.includes(q));
    const names = Array.from(new Set(list.map(e => e.group)));
    return names.map(name => ({ name, items: list.filter(e => e.group === name) }));
  });

  readonly summary = computed(() => {
    const list = this.events();
    return {
      sms: list.filter(e => e.isSmsEnabled).length,
      inApp: list.filter(e => e.isNotificationEnabled).length,
      total: list.length,
      failed: list.reduce((s, e) => s + e.failedLast30Days, 0),
    };
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.events.set(await firstValueFrom(this.api.getEvents()) ?? []);
    } catch {
      this.events.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async update(event: NotificationEvent, patch: Partial<NotificationEvent>): Promise<void> {
    const before = event;
    const after = { ...event, ...patch };
    this.replace(after);
    this.savingCode.set(event.code);
    try {
      await firstValueFrom(this.api.updateEvent({
        code: after.code,
        isSmsEnabled: after.isSmsEnabled,
        isNotificationEnabled: after.isNotificationEnabled,
        sendToAllParticipants: after.sendToAllParticipants,
        templateId: after.templateId,
      }));
      if (patch.templateId !== undefined) {
        const t = after.templates.find(x => x.id === after.templateId);
        this.replace({ ...after, templateContent: t?.content ?? null });
      }
    } catch {
      this.replace(before); // بازگشت
    } finally {
      this.savingCode.set(null);
    }
  }

  async setAll(channel: 'sms' | 'inApp', enabled: boolean): Promise<void> {
    for (const e of this.events()) {
      const current = channel === 'sms' ? e.isSmsEnabled : e.isNotificationEnabled;
      if (current !== enabled) {
        await this.update(e, channel === 'sms' ? { isSmsEnabled: enabled } : { isNotificationEnabled: enabled });
      }
    }
    this.toast.success('اعمال شد.');
  }

  private replace(e: NotificationEvent): void {
    this.events.update(list => list.map(x => x.code === e.code ? e : x));
  }
}
