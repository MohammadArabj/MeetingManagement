import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DraftSaved, PublicSurvey, ResponseAnswerDto, UserDraft, UserStatus } from './take-survey.model';

/** خطای منطقی سرور (Result.isSuccess = false) */
export class SurveyApiError extends Error {
  constructor(message: string) { super(message); this.name = 'SurveyApiError'; }
}

interface ApiResult<T> { isSuccess: boolean; message?: string; data: T; }

/**
 * فراخوانی‌های صفحه‌ی پاسخ‌دهی. HttpClient مستقیم (نه HttpService) تا:
 *  • ذخیره‌ی خودکار نوار بارگذاری/پیام خطا نمایش ندهد،
 *  • پاسخ ناموفق سرور همیشه به‌صورت خطا برگردد (قبلاً صفحه‌ی تشکر بعد از رد شدن ثبت نمایش داده می‌شد).
 * توکن (در صورت ورود) توسط authInterceptor اضافه می‌شود؛ کاربر ناشناس بدون توکن کار می‌کند.
 */
@Injectable({ providedIn: 'root' })
export class TakeSurveyApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.getServiceUrl();
  private readonly quiet = new HttpHeaders({ loading: 'false' });

  getSurvey(guid: string): Observable<PublicSurvey> {
    return this.unwrap(this.http.get<ApiResult<PublicSurvey>>(`${this.base}Survey/Public/${encodeURIComponent(guid)}`));
  }

  getStatus(guid: string): Observable<UserStatus> {
    return this.unwrap(this.http.get<ApiResult<UserStatus>>(`${this.base}Response/UserStatus/${encodeURIComponent(guid)}`, { headers: this.quiet }));
  }

  getDraft(guid: string): Observable<UserDraft | null> {
    return this.unwrap(this.http.get<ApiResult<UserDraft | null>>(`${this.base}Response/MyDraft/${encodeURIComponent(guid)}`, { headers: this.quiet }));
  }

  saveDraft(surveyGuid: string, answers: ResponseAnswerDto[]): Observable<DraftSaved> {
    return this.unwrap(this.http.post<ApiResult<DraftSaved>>(`${this.base}Response/SaveDraft`, { surveyGuid, answers }, { headers: this.quiet }));
  }

  discardDraft(surveyGuid: string): Observable<boolean> {
    return this.unwrap(this.http.post<ApiResult<boolean>>(`${this.base}Response/DiscardDraft/${encodeURIComponent(surveyGuid)}`, {}, { headers: this.quiet }));
  }

  submit(surveyGuid: string, isAnonymous: boolean, answers: ResponseAnswerDto[]): Observable<string> {
    return this.unwrap(this.http.post<ApiResult<string>>(`${this.base}Response/Submit`, { surveyGuid, isAnonymous, answers }));
  }

  private unwrap<T>(source: Observable<ApiResult<T>>): Observable<T> {
    return source.pipe(map(r => {
      if (r && typeof r === 'object' && 'isSuccess' in r) {
        if (!r.isSuccess) throw new SurveyApiError(r.message || 'عملیات انجام نشد.');
        return r.data;
      }
      return r as unknown as T;
    }));
  }
}
