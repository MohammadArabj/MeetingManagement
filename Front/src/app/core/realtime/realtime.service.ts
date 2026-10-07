import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SessionStore } from '../auth/session.store';
import { ToastService } from '../../services/framework-services/toast.service';

/** اعلانی که سرور (NotificationsHub) ارسال می‌کند */
export interface RealtimeNotification {
  type: string;
  title: string;
  message: string;
  link?: string | null;
  meetingGuid?: string | null;
  occurredAt: string;
}

/** نوع رویدادهایی که داده‌های کارتابل جلسات را تغییر می‌دهند */
const MEETING_EVENTS = new Set([
  'MeetingCreated', 'MeetingRescheduled', 'MeetingCanceled', 'MinutesReadyForSignature',
  'ChairmanSigned', 'MeetingFinalized', 'SubstituteAssigned', 'AttendanceRequested',
]);

/**
 * اتصال لحظه‌ای به سرور (SignalR: /hubs/notifications).
 * ─────────────────────────────────────────────────────────────────────────
 *  • با ورود کاربر وصل و با خروج قطع می‌شود؛ سمت فعال در Query String ارسال و در سرور راستی‌آزمایی می‌شود.
 *  • قطع ارتباط → اتصال مجدد خودکار؛ پس از شکست کامل هر ۳۰ ثانیه دوباره تلاش می‌شود.
 *  • هر اعلان: نمایش toast + انتشار در notifications$ (زنگوله، داشبورد و فهرست‌ها از آن به‌روز می‌شوند).
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);

  private connection: HubConnection | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectedPosition = '';

  private readonly _notifications = new Subject<RealtimeNotification>();
  /** همه‌ی اعلان‌های دریافتی */
  readonly notifications$ = this._notifications.asObservable();

  private readonly _meetingChanged = new Subject<RealtimeNotification>();
  /** اعلان‌هایی که کارتابل/داشبورد جلسات را تغییر می‌دهند */
  readonly meetingChanged$ = this._meetingChanged.asObservable();

  readonly connected = signal(false);

  /** شروع (یا اتصال مجدد در صورت تغییر سمت) */
  async start(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;

    const position = this.session.positionGuid();
    if (this.connection && this.connectedPosition === position
        && this.connection.state !== HubConnectionState.Disconnected) return;

    await this.stop();
    this.connectedPosition = position;

    const query = new URLSearchParams();
    if (position) query.set('positionGuid', position);
    const actingUser = this.session.userGuid();
    if (actingUser && actingUser !== this.session.tokenUserGuid()) query.set('actingUser', actingUser);

    const url = `${environment.getServiceUrl().replace(/\/api\/?$/, '')}/hubs/notifications?${query}`;

    this.connection = new HubConnectionBuilder()
      .withUrl(url, { accessTokenFactory: () => this.auth.accessToken() ?? '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();

    this.connection.on('notification', (n: RealtimeNotification) => this.handle(n));
    this.connection.onreconnected(() => this.connected.set(true));
    this.connection.onreconnecting(() => this.connected.set(false));
    this.connection.onclose(() => {
      this.connected.set(false);
      this.scheduleRetry();
    });

    try {
      await this.connection.start();
      this.connected.set(true);
    } catch {
      this.connected.set(false);
      this.scheduleRetry();
    }
  }

  async stop(): Promise<void> {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const connection = this.connection;
    this.connection = null;
    this.connected.set(false);
    if (connection) {
      connection.off('notification');
      try { await connection.stop(); } catch { /* بی‌اهمیت */ }
    }
  }

  /** ثبت در DestroyRef یک کامپوننت (مثلاً AppShell) تا با خروج از پوسته قطع شود */
  bindTo(destroyRef: DestroyRef): void {
    destroyRef.onDestroy(() => void this.stop());
  }

  private handle(n: RealtimeNotification): void {
    this.toast.info(n.message, n.title);
    this._notifications.next(n);
    if (MEETING_EVENTS.has(n.type)) this._meetingChanged.next(n);
  }

  private scheduleRetry(): void {
    if (this.retryTimer || !this.auth.isAuthenticated()) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.start();
    }, 30_000);
  }
}
