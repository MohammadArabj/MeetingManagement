import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { safeReturnUrl } from '../../services/framework-services/auth-utils';

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
  ) { }

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParams;
    const surveyUser = params['u'] as string | undefined;
    const surveyKey = params['k'] as string | undefined;
    const surveyGuid = params['guid'] as string | undefined;
    // ✅ guid فقط به‌صورت GUID معتبر پذیرفته می‌شود و «to» فقط مسیر داخلی امن (بدون open redirect)
    const destination = surveyGuid && GUID.test(surveyGuid)
      ? `/survey/take/${surveyGuid}`
      : safeReturnUrl(params['to']);

    if (!surveyUser || !surveyKey) {
      this.hasError = true;
      return;
    }

    sessionStorage.setItem('survey_return_url', destination);

    try {
      if (!await this.codeFlowService.isLoggedIn()) {
        await this.codeFlowService.startSurveyAuthentication(surveyUser, surveyKey);
        return;
      }
      // کاربر از قبل وارد شده: پروفایل/سمت در getCurrentUser ذخیره شده است؛
      // نشست و دسترسی‌ها را گارد مقصد (authGuard / surveyAuthGuard) بررسی می‌کند.
      sessionStorage.removeItem('survey_return_url');
      await this.router.navigateByUrl(destination, { replaceUrl: true });
    } catch (err) {
      console.error('[SurveyAuth] authentication failed', err);
      this.hasError = true;
    }
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
