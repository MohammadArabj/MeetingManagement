import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { RequestConfig } from './framework-services/http.service';
import { ServiceBase } from './framework-services/service.base';
import {
  CreateSurveyWithQuestionsDto,
  WizardSurveyData,
  WizardQuestionData,
  WizardAccessItem,
  WizardCriterionData
} from '../core/models/survey-wizard.model';
import { MySurveyListDto } from '../core/models/survey';
import { DemographicBucketDto } from '../core/models/survey-analytics.model';

// ==================== RESPONSE INTERFACES ====================

/**
 * ✅ Response برای GetDetailWithQuestions
 */
export interface GetSurveyWithQuestionsResponse {
  survey: WizardSurveyData;
  questions: WizardQuestionData[];
  accessItems: WizardAccessItem[];
  criteria: WizardCriterionData[]; // ✅ اضافه شد
}
export interface SurveyPublicLinkDto {
  surveyGuid: string;
  title: string;
  publicUrl: string;
  qrCodeBase64: string;
  isActive: boolean;
  status: string;
  startDate: string;
  endDate: string;
  totalResponses: number;
  maxResponses?: number;
}

// ==================== OTHER INTERFACES ====================

export interface SurveyListDto {
  guid: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  statusEnum: number;
  accessType: string;
  totalResponses: number;
  maxResponses?: number;
  allowAnonymous: boolean;
  isActive: boolean;
  createdBy: string;
  created: string;
}

export interface SurveyDetailDto {
  showType: number;
  guid: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: number;
  statusText: string;
  accessType: number;
  accessTypeText: string;
  allowAnonymous: boolean;
  allowSaveDraft: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  allowMultipleResponses: boolean;
  welcomeMessage?: string;
  thankYouMessage?: string;
  maxResponses?: number;
  totalResponses: number;
  requireLogin: boolean;
  version: number;
  publishedDate?: string;
  publishedBy?: string;
  themeColor?: string;
  logoUrl?: string;
  backgroundImageUrl?: string;
  totalQuestions: number;
  createdBy: string;
  created: string;
  hasCriteria?: boolean;
  criteria?: SurveyCriterionDto[];
}

export interface SurveyComboDto {
  guid: string;
  title: string;
}

export interface SurveyStatisticsDto {
  completionRate: number;
  draftResponses: number;
  completedResponses: number;
  surveyGuid: string;
  title: string;
  totalQuestions: number;
  totalResponses: number;
  averageTimeSpent: number; // به دقیقه
  responsesByDate: Record<string, number>;

  responsesByAge: DemographicBucketDto[];
  responsesByGender: DemographicBucketDto[];
  responsesByOffice: DemographicBucketDto[];
  responsesByEmploymentType: DemographicBucketDto[];
  responsesByEducation: DemographicBucketDto[];
  responsesByShiftWorker: DemographicBucketDto[];
  responsesByExperienceYears: DemographicBucketDto[];
  responsesByOrganizationalGrade: DemographicBucketDto[];
  responsesByOrganizationalGroup: DemographicBucketDto[];
}

export interface SurveyChangeLogDto {
  id: number;
  changeType: string;
  description: string;
  version: number;
  changeDate: string;
  changedBy: string;
}

export interface SurveySearchRequest {
  title?: string;
  status?: number;
  accessType?: number;
  creatorUserGuid?: string;
  allowAnonymous?: boolean;
  startDateFrom?: string;
  startDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  pageNumber?: number;
  pageSize?: number;
}
export interface SurveyCriterionDto {
  guid: string;
  title: string;
  description?: string;
  sortOrder: number;
}


export interface CreateOrEditSurveyDto {
  guid?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  accessType: number;
  allowAnonymous: boolean;
  allowSaveDraft: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  allowMultipleResponses: boolean;
  welcomeMessage?: string;
  thankYouMessage?: string;
  maxResponses?: number;
  requireLogin: boolean;
  themeColor?: string;
  logoUrl?: string;
  backgroundImageUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SurveyService extends ServiceBase {

  constructor() {
    super('Survey');
  }

  // ==================== WIZARD METHODS ====================

  /**
   * ✅ ایجاد یا ویرایش نظرسنجی همراه با سوالات (Wizard)
   */
  createOrEditWithQuestions(dto: CreateSurveyWithQuestionsDto): Observable<{ guid: string }> {
    const path = `${this.baseUrl}/CreateOrEditWithQuestions`;
    return this.httpService.post<{ guid: string }>(path, dto);
  }

  /**
   * ✅ دریافت نظرسنجی و سوالات برای Edit Mode
   */
  getDetailWithQuestions(guid: string): Observable<GetSurveyWithQuestionsResponse> {
    const path = `${this.baseUrl}/GetDetailWithQuestions/${guid}`;
    return this.httpService.get<GetSurveyWithQuestionsResponse>(path);
  }

  // ==================== SEARCH ====================
  searchSurveys(searchData: SurveySearchRequest): Observable<SurveyListDto[]> {
    const path = `${this.baseUrl}/Search`;
    return this.httpService.post<SurveyListDto[]>(
      path,
      searchData,
      new RequestConfig({ noValidate: true, submitted: false }),
      false
    );
  }

  // ==================== GET DETAIL ====================
  getDetail(guid: string): Observable<SurveyDetailDto> {
    const path = `${this.baseUrl}/GetDetail/${guid}`;
    return this.httpService.get<SurveyDetailDto>(path);
  }

  // ==================== GET COMBO ====================
  getComboList(): Observable<SurveyComboDto[]> {
    const path = `${this.baseUrl}/Combo`;
    return this.httpService.getAll<SurveyComboDto[]>(path);
  }

  // ==================== STATISTICS ====================
  getStatistics(surveyGuid: string): Observable<SurveyStatisticsDto> {
    const path = `${this.baseUrl}/Statistics/${surveyGuid}`;
    return this.httpService.get<SurveyStatisticsDto>(path);
  }

  // ==================== CHANGE LOGS ====================
  getChangeLogs(surveyGuid: string): Observable<SurveyChangeLogDto[]> {
    const path = `${this.baseUrl}/ChangeLogs/${surveyGuid}`;
    return this.httpService.get<SurveyChangeLogDto[]>(path);
  }

  // ==================== CREATE OR EDIT ====================
  createOrEdit(survey: CreateOrEditSurveyDto): Observable<{ guid: string }> {
    const path = `${this.baseUrl}/CreateOrEdit`;
    return this.httpService.post<{ guid: string }>(path, survey);
  }

  // ==================== STATUS CHANGES ====================

  publishSurvey(guid: string): Observable<boolean> {
    const path = `${this.baseUrl}/Publish/${guid}`;
    return this.httpService.post<boolean>(path, {}, new RequestConfig({ noValidate: true }));
  }

  activateSurvey(guid: string): Observable<boolean> {
    return this.activate(guid) as Observable<boolean>;
  }

  pauseSurvey(guid: string): Observable<boolean> {
    const path = `${this.baseUrl}/Pause/${guid}`;
    return this.httpService.post<boolean>(path, {}, new RequestConfig({ noValidate: true }));
  }

  closeSurvey(guid: string): Observable<boolean> {
    const path = `${this.baseUrl}/Close/${guid}`;
    return this.httpService.post<boolean>(path, {}, new RequestConfig({ noValidate: true }));
  }

  archiveSurvey(guid: string): Observable<boolean> {
    const path = `${this.baseUrl}/Archive/${guid}`;
    return this.httpService.post<boolean>(path, {}, new RequestConfig({ noValidate: true }));
  }

  // ==================== DELETE ====================
  deleteSurvey(guid: string): Observable<boolean> {
    return this.delete(guid) as Observable<boolean>;
  }
  /**
   * دریافت نظرسنجی‌های اختصاص‌یافته به کاربر جاری
   * @param filter فیلتر اختیاری: 0=همه, 1=شروع‌نشده, 2=درحال‌انجام, 3=تکمیل‌شده, 4=منقضی
   */
  getMySurveys(filter?: number): Observable<MySurveyListDto[]> {
    const params = filter != null ? `?filter=${filter}` : '';
    return this.httpService
      .getAll<MySurveyListDto[]>(`${this.baseUrl}/MySurveys${params}`)
      .pipe(
        map((result: any) => result?.data ?? result ?? [])
      );
  }

  /**
   * دریافت اطلاعات عمومی نظرسنجی (بدون نیاز به لاگین)
   * فقط برای بررسی allowAnonymous و requireLogin
   */
  getPublicSurveyInfo(guid: string): Observable<any> {
    return this.httpService
      .getFullUrlNoAuth(`${this.baseUrl}/Public/${guid}`)
      .pipe(
        map((result: any) => result?.data ?? result)
      );
  }
  // ⭐ اضافه کن
  /**
   * دریافت لینک عمومی و QR Code نظرسنجی
   */
  getPublicLink(guid: string): Observable<{ data: SurveyPublicLinkDto }> {
    const path = `${this.baseUrl}/GetPublicLink/${guid}`;
    return this.httpService.get<{ data: SurveyPublicLinkDto }>(path);
  }

  // ⭐ اضافه کن (برای صفحه عمومی)
  /**
   * دریافت نظرسنجی عمومی برای پاسخ‌دهی (بدون احراز هویت)
   */
  getPublicSurvey(guid: string): Observable<any> {
    const path = `${this.baseUrl}/Public/${guid}`;
    return this.httpService.get<any>(path);
  }

}