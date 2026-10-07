import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { safeReturnUrl } from '../../services/framework-services/auth-utils';
@Component({ standalone: true, selector: 'app-auth-error', template: `
  <main dir="rtl" style="max-width:40rem;margin:3rem auto;padding:1rem">
    <h1>ورود تکمیل نشد</h1><p role="alert">{{ message }}</p>
    <button type="button" [disabled]="busy()" (click)="retry()">تلاش دوباره</button>
    <button type="button" [disabled]="busy()" (click)="login()">ورود مجدد</button>
    @if (failed()) { <p role="alert">ارتباط برقرار نشد؛ دوباره تلاش کنید.</p> }
  </main>` })
export class AuthErrorComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(CodeFlowService);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly failed = signal(false);
  private readonly reason = this.route.snapshot.queryParamMap.get('reason') ?? 'service';
  readonly message = ({
    service: 'ارتباط با سرویس مدیریت کاربران کامل نشد. نشست SSO شما بسته نشده است.',
    access: 'برای این سامانه دسترسی تأیید نشد. با مسئول سامانه تماس بگیرید.',
    session: 'نشست این ورود معتبر نیست. دوباره وارد شوید.',
    unauthorized: 'درخواست توسط API تأیید نشد. در صورت تکرار، تنظیمات توکن باید بررسی شود.',
    configuration: 'اتصال نشست SSO به مدیریت کاربران تنظیم نشده است. با مسئول سامانه تماس بگیرید.',
    profile: 'شناسه کاربر در پاسخ SSO وجود ندارد. تنظیمات Claim باید بررسی شود.',
    callback: 'پاسخ ورود معتبر نبود یا قبلاً مصرف شده است. ورود مجدد را انتخاب کنید.'
  } as Record<string, string>)[this.reason] ?? 'ورود تکمیل نشد.';
  async retry(): Promise<void> {
    if (this.reason === 'callback' || this.reason === 'session' || this.reason === 'unauthorized') return this.login();
    this.busy.set(true);
    try { await this.router.navigateByUrl(safeReturnUrl(sessionStorage.getItem('survey_return_url'))); }
    finally { this.busy.set(false); }
  }
  async login(): Promise<void> {
    this.busy.set(true); this.failed.set(false);
    try { await this.auth.startAuthentication(true); }
    catch { this.failed.set(true); }
    finally { this.busy.set(false); }
  }
}
