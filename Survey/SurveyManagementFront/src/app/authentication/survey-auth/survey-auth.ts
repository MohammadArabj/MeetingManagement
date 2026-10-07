import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { UserService } from '../../services/user.service';
import { PermissionService } from '../../services/permission.service';
import {
  ACCESS_TOKEN_NAME, IsDeletage, Main_USER_ID,
  PERMISSIONS_NAME, POSITION_ID, POSITION_NAME, ROLE_TOKEN_NAME,
  USER_CURRENT_ACTIVE_SESSION_NAME, USER_ID_NAME,
} from '../../core/types/configuration';

@Component({
  selector: 'app-survey-auth',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="survey-auth-wrapper">
      <div class="survey-auth-card">
        <ng-container *ngIf="!hasError; else errorTpl">
          <div class="spinner"></div>
          <p>در حال آماده‌سازی نظرسنجی، لطفاً منتظر بمانید...</p>
        </ng-container>
        <ng-template #errorTpl>
          <p class="error-msg">⚠️ لینک نظرسنجی معتبر نیست یا منقضی شده است.</p>
          <button (click)="goHome()">بازگشت به صفحه اصلی</button>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .survey-auth-wrapper {
      display: flex; align-items: center;
      justify-content: center; height: 100vh; background: #f5f5f5;
    }
    .survey-auth-card {
      text-align: center; padding: 2rem; background: white;
      border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,.1);
    }
    .spinner {
      width: 40px; height: 40px; border: 4px solid #e0e0e0;
      border-top-color: #3f51b5; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-msg { color: #e53935; margin-bottom: 1rem; }
  `]
})
export class SurveyAuthComponent implements OnInit {
  hasError = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly codeFlowService: CodeFlowService,
    private readonly localStorageService: LocalStorageService,
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
  ) { }

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParams;
    const surveyUser = params['u'] as string | undefined;
    const surveyKey = params['k'] as string | undefined;
    const surveyGuid = params['guid'] as string | undefined;
    const destination = surveyGuid
      ? `/survey/take/${surveyGuid}`
      : (params['to'] as string | undefined) ?? '/dashboard';

    // ─── پارامترهای ضروری ────────────────────────────────────────────────────
    if (!surveyUser || !surveyKey) {
      this.hasError = true;
      return;
    }

    // ─── ذخیره مقصد نهایی برای بعد از challenge ─────────────────────────────
    sessionStorage.setItem('survey_return_url', destination);

    // ─── اگر لاگین نیست → شروع احراز هویت ──────────────────────────────────
    if (!await this.codeFlowService.isLoggedIn()) {
      try {
        await this.codeFlowService.startSurveyAuthentication(surveyUser, surveyKey);
      } catch (err) {
        console.error('[SurveyAuth] خطا در شروع احراز هویت:', err);
        this.hasError = true;
      }
      return;
    }

    // ─── اگر لاگین هست → مثل challenge همه چیز را لود کن ───────────────────
    // چون ممکنه localStorage خالی باشه (مثلاً تب جدید یا session جدید)
    this.storeUserProfile(destination);
  }

  // ─── ذخیره اطلاعات کاربر (کپی از challenge) ──────────────────────────────
  private storeUserProfile(destination: string): void {
    const profile = this.codeFlowService.user?.profile as Record<string, string>;

    // اگر profile خالی بود یعنی user object لود نشده → باید completeAuthentication بشه
    // این حالت نباید پیش بیاد چون isLoggedIn چک کردیم، ولی defensive check
    if (!profile) {
      this.codeFlowService.logout();
      return;
    }

    this.localStorageService.setItem(USER_ID_NAME, profile['id'] ?? '');
    this.localStorageService.setItem(Main_USER_ID, profile['id'] ?? '');
    this.localStorageService.setItem(POSITION_ID, profile['activatedPosition'] ?? '');
    this.localStorageService.setItem(POSITION_NAME, profile['positionTitle'] ?? '');
    this.localStorageService.setItem(ROLE_TOKEN_NAME, profile['position'] ?? '');
    this.localStorageService.setItem(IsDeletage, profile['isDelegate'] ?? '');
    this.localStorageService.setItem(
      ACCESS_TOKEN_NAME,
      this.codeFlowService.user?.access_token ?? ''
    );

    this.loadSessionAndPermissions(destination);
  }

  private loadSessionAndPermissions(destination: string): void {
    const positionGuid = this.localStorageService.getItem(POSITION_ID);

    this.userService.getCurrentSession().subscribe({
      next: (sessionData) => {
        if (!sessionData?.sessionGuid) {
          this.codeFlowService.logout();
          return;
        }
        this.localStorageService.setItem(USER_CURRENT_ACTIVE_SESSION_NAME, sessionData.sessionGuid);
        this.loadPermissions(positionGuid, destination);
      },
      error: () => this.codeFlowService.logout(),
    });
  }

  private loadPermissions(positionGuid: string | null, destination: string): void {
    this.permissionService.getPositionPermissions(positionGuid ?? '').subscribe({
      next: (permissions) => {
        this.localStorageService.removeItem(PERMISSIONS_NAME);
        this.localStorageService.setItem(PERMISSIONS_NAME, permissions);

        // ─── ذخیره رو پاک کن و برو مقصد ─────────────────────────────────────
        sessionStorage.removeItem('survey_return_url');
        this.router.navigateByUrl(destination);
      },
      error: () => this.codeFlowService.logout(),
    });
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }
}