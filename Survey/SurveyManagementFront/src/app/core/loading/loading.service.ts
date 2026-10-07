import { computed, Injectable, signal } from '@angular/core';

/**
 * شمارنده درخواست‌های در حال اجرا.
 * ✅ جایگزین jQuery روی «.loading-overlay» — نسخه قبلی overlay محلی کامپوننت‌ها را دستکاری
 * می‌کرد و در درخواست‌های لغوشده (switchMap / تغییر صفحه) هرگز مخفی نمی‌شد.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _pending = signal(0);
  readonly pending = this._pending.asReadonly();
  readonly isLoading = computed(() => this._pending() > 0);

  start(): void { this._pending.update(n => n + 1); }
  stop(): void { this._pending.update(n => Math.max(0, n - 1)); }
}
