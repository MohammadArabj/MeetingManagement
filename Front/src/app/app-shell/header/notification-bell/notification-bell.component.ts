import { ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, HostListener, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, interval, startWith, switchMap, catchError, of, filter } from 'rxjs';
import { SessionStore } from '../../../core/auth/session.store';
import { AlarmItem, AlarmList, NotificationCenterService } from '../../../services/notification-center.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';

/** پشتیبان در صورت قطع اتصال لحظه‌ای */
const POLL_MS = 5 * 60_000;

/**
 * زنگوله اعلان‌های داخل سامانه (برای سمت فعال).
 * با هر اعلان لحظه‌ای (SignalR) فوراً به‌روز می‌شود؛ هر ۵ دقیقه (فقط وقتی تب فعال است) هم برای اطمینان
 * دوباره خوانده می‌شود و با تغییر سمت دوباره بارگذاری می‌شود.
 */
@Component({
  selector: 'app-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bell" [class.open]="open()">
      <button type="button" class="bell-btn" (click)="toggle()" [attr.aria-expanded]="open()" aria-label="اعلان‌ها">
        <i class="fas fa-bell"></i>
        @if (unread() > 0) { <span class="bell-badge">{{ unread() > 99 ? '99+' : unread() }}</span> }
      </button>

      @if (open()) {
        <div class="bell-panel" role="dialog" aria-label="اعلان‌ها">
          <div class="bell-head">
            <strong>اعلان‌ها</strong>
            @if (unread() > 0) {
              <button type="button" class="btn btn-link btn-sm p-0" (click)="markAll()">خواندن همه</button>
            }
          </div>
          <div class="bell-list">
            @for (a of items(); track a.id) {
              <button type="button" class="bell-item" [class.unread]="!a.isRead" (click)="read(a)">
                <div class="fw-semibold small">{{ a.title }}</div>
                <div class="small text-muted msg">{{ a.message }}</div>
              </button>
            } @empty {
              <div class="text-center text-muted small py-4">اعلانی وجود ندارد.</div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .bell { position: relative; }
    .bell-btn { position: relative; border: 0; background: transparent; width: 40px; height: 40px; border-radius: 50%;
      color: inherit; font-size: 1.1rem; }
    .bell-btn:hover { background: rgba(0,0,0,.06); }
    .bell-badge { position: absolute; top: 2px; left: 2px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px;
      background: var(--bs-danger, #dc3545); color: #fff; font-size: .65rem; line-height: 18px; text-align: center; }
    .bell-panel { position: absolute; top: calc(100% + 6px); left: 0; width: 340px; max-height: 440px; display: flex; flex-direction: column;
      background: var(--bs-body-bg, #fff); color: var(--bs-body-color, #212529); border-radius: .75rem;
      box-shadow: 0 10px 30px rgba(0,0,0,.15); z-index: 1050; overflow: hidden; }
    .bell-head { display: flex; justify-content: space-between; align-items: center; padding: .6rem .9rem;
      border-bottom: 1px solid var(--bs-border-color, #e5e7eb); }
    .bell-list { overflow: auto; }
    .bell-item { display: block; width: 100%; text-align: right; border: 0; background: transparent; padding: .6rem .9rem;
      border-bottom: 1px solid var(--bs-border-color-translucent, #f1f1f1); }
    .bell-item:hover { background: var(--bs-tertiary-bg, #f8f9fa); }
    .bell-item.unread { background: color-mix(in srgb, var(--bs-primary, #0d6efd) 6%, transparent); }
    .bell-item .msg { white-space: normal; line-height: 1.6; }
  `],
})
export class NotificationBellComponent {
  private readonly api = inject(NotificationCenterService);
  private readonly session = inject(SessionStore);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly realtime = inject(RealtimeService);

  readonly open = signal(false);
  readonly unread = signal(0);
  readonly items = signal<AlarmItem[]>([]);

  constructor() {
    interval(POLL_MS).pipe(
      startWith(0),
      filter(() => document.visibilityState === 'visible'),
      switchMap(() => this.api.myAlarms(false, 20).pipe(catchError(() => of<AlarmList>({ items: [], unread: 0 })))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(list => this.apply(list));

    this.realtime.notifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.refresh());

    // با تغییر سمت فعال، اعلان‌های همان سمت نمایش داده شود
    effect(() => {
      this.session.positionGuid();
      untracked(() => void this.refresh());
    });
  }

  toggle(): void {
    this.open.update(v => !v);
    if (this.open()) void this.refresh();
  }

  async read(a: AlarmItem): Promise<void> {
    if (a.isRead) return;
    this.items.update(list => list.map(x => x.id === a.id ? { ...x, isRead: true } : x));
    this.unread.update(n => Math.max(0, n - 1));
    try { await firstValueFrom(this.api.markRead(a.id)); } catch { /* بی‌اهمیت */ }
  }

  async markAll(): Promise<void> {
    this.items.update(list => list.map(x => ({ ...x, isRead: true })));
    this.unread.set(0);
    try { await firstValueFrom(this.api.markAllRead()); } catch { /* بی‌اهمیت */ }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  private async refresh(): Promise<void> {
    try { this.apply(await firstValueFrom(this.api.myAlarms(false, 20))); } catch { /* بی‌اهمیت */ }
  }

  private apply(list: AlarmList): void {
    this.items.set(list?.items ?? []);
    this.unread.set(list?.unread ?? 0);
  }
}
