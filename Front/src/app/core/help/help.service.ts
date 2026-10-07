import { Injectable, signal } from '@angular/core';

/**
 * باز/بسته کردن پنل راهنما. محتوای راهنما بر اساس آدرس صفحه‌ی جاری از help-content.ts انتخاب می‌شود.
 * از هر جای برنامه: دکمه‌ی «؟» سرصفحه، کلید F1، یا help.open('meetings.list').
 */
@Injectable({ providedIn: 'root' })
export class HelpService {
  readonly isOpen = signal(false);
  /** کلید راهنمای دلخواه (اگر null باشد، از روی آدرس صفحه تشخیص داده می‌شود) */
  readonly topic = signal<string | null>(null);

  open(topic: string | null = null): void {
    this.topic.set(topic);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }
}
