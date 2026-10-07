import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { RequestConfig } from './framework-services/http.service';
import { ServiceBase } from './framework-services/service.base';
import { ResponseMatrixDto } from '../core/models/response-report';
import { SurveyAnalyticsDto } from '../core/models/survey-analytics.model';

// ==================== INTERFACES ====================

export interface ResponseListDto {
  age: any;
  experienceYears: any;
  organizationalGroup: any;
  organizationalGrade: any;
  shiftWorker: any;
  education: any;
  employmentType: any;
  office: any;
  guid: string;
  surveyGuid: string;
  surveyTitle: string;
  ageGroup?: string;
  gender?: string;
  shift?: string;
  unitTitle?: string;
  startedAt: string;
  completedAt?: string;
  timeSpentSeconds?: number;
  timeSpentText?: string;
}

export interface ResponseDetailDto {
  guid: string;
  surveyGuid: string;
  surveyTitle: string;
  ageGroup?: string;
  gender?: string;
  age?: string;
  office?: string;
  education?: string;
  employmentType?: string;
  experienceYears?: string;
  organizationalGroup?: string;
  organizationalGrade?: string;
  shiftWorker?: string;
  unitTitle?: string;
  startedAt: string;
  completedAt?: string;
  timeSpentSeconds?: number;
  answers: ResponseAnswerDetailDto[];
}

export interface ResponseAnswerDetailDto {
  id: number;
  questionGuid: string;
  questionText: string;
  questionType: number;
  textAnswer?: string;
  numericAnswer?: number;
  dateAnswer?: string;
  selectedOption?: string;
  selectedOptions?: string[];
  otherAnswer?: string;
  fileUrl?: string;
  fileName?: string;
  // ✅ بک‌اند سمت خواندن (ResponseAnswerDetailDto) رتبه‌بندی رو به‌صورت List<string> پارس می‌کنه — این string[] درسته و نباید عوض بشه
  matrixAnswers?: { [key: string]: string };
  rankingAnswers?: string[];
  answeredAt: string;
  timeSpentSeconds?: number;
  isSkipped: boolean;
}

export interface ResponseSummaryDto {
  surveyGuid: string;
  surveyTitle: string;
  totalResponses: number;
  averageTimeSpent: number;
  responsesByDate: { [key: string]: number };
}

export interface ResponseSearchRequest {
  surveyGuid?: string;
  ageGroup?: string;
  gender?: string;
  shift?: string;
  unitTitle?: string;
  completedDateFrom?: string;
  completedDateTo?: string;
  pageNumber?: number;
  pageSize?: number;
}
export interface ParticipantListDto {
  personnelCode: string;
  fullName: string;
}

export interface ParticipantsReportDto {
  surveyTitle: string;
  participants: ParticipantListDto[];
}

export interface SubmitResponseDto {
  surveyGuid: string;
  isAnonymous: boolean;
  answers: SubmitAnswerDto[];
}

export interface SubmitAnswerDto {
  questionGuid: string;
  questionType: number;
  textAnswer?: string;
  numericAnswer?: number;
  dateAnswer?: string;
  selectedOptionGuid?: string;
  selectedOptionGuids?: string[];
  otherAnswer?: string;
  fileUrl?: string;
  fileName?: string;
  // ✅ بک‌اند ResponseAnswerDto.FileSize رو داره (long?) — بدونش FILE_UPLOAD کامل نمی‌رسه
  fileSize?: number;
  matrixAnswers?: { [key: string]: string };
  // ✅ بک‌اند سمت ارسال (ResponseAnswerDto.RankingAnswers) از نوع List<int>ه، نه رشته
  rankingAnswers?: number[];
  isSkipped?: boolean;
  timeSpentSeconds?: number;
}

export interface UserResponseStatusDto {
  hasParticipated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ResponseService extends ServiceBase {
  private readonly httpClient = inject(HttpClient);

  constructor() {
    super('Response');
  }

// داخل کلاس ResponseService:

getParticipants(surveyGuid: string) {
  return this.httpService.get<ParticipantsReportDto >(
    `${this.baseUrl}/Participants/${surveyGuid}`
  );
}

exportParticipants(surveyGuid: string) {
  const path = `${this.baseUrl}/ParticipantsExport`;
  const body = {
    surveyGuid
  };
  return this.httpClient
    .post(path, body, { responseType: 'blob', observe: 'response' })
    .pipe(map((response) => response.body as Blob));
}
  // ==================== SEARCH ====================
  searchResponses(searchData: ResponseSearchRequest): Observable<ResponseListDto[]> {
    const path = `${this.baseUrl}/Search`;
    return this.httpService.post<ResponseListDto[]>(
      path,
      searchData,
      new RequestConfig({ noValidate: true, submitted: false }),
      false
    );
  }

  /**
   * ارسال پاسخ نظرسنجی — هوشمند (با یا بدون توکن)
   */
  submitResponseSmart(data: SubmitResponseDto): Observable<any> {
    if (data.isAnonymous) {
      return this.httpService
        .postFullUrlNoAuth(`${this.baseUrl}/Submit`, data)
        .pipe(map((result: any) => result?.data ?? result));
    }
    return this.submitResponse(data);
  }

  getDetail(guid: string): Observable<ResponseDetailDto> {
    const path = `${this.baseUrl}/GetDetail/${guid}`;
    return this.httpService.get<ResponseDetailDto>(path);
  }

  getSummary(surveyGuid: string): Observable<ResponseSummaryDto> {
    const path = `${this.baseUrl}/Summary/${surveyGuid}`;
    return this.httpService.get<ResponseSummaryDto>(path);
  }

  // ==================== EXPORT ====================
  exportResponses(surveyGuid: string, columns?: string[]): Observable<Blob> {
    const path = `${this.baseUrl}/Export`;
    const body = {
      surveyGuid,
      columns: columns ?? []
    };
    return this.httpClient
      .post(path, body, { responseType: 'blob', observe: 'response' })
      .pipe(map((response) => response.body as Blob));
  }

  submitResponse(submitData: SubmitResponseDto) {
    const path = `${this.baseUrl}/Submit`;
    return this.httpService.post(path, submitData);
  }

  deleteResponse(guid: string): Observable<boolean> {
    return this.delete(guid) as Observable<boolean>;
  }

  getUserResponseStatus(surveyGuid: string, userGuid: string) {
    return this.httpService.get<UserResponseStatusDto>(
      `${this.baseUrl}/UserStatus/${surveyGuid}/${userGuid}`
    );
  }

  getMatrix(surveyGuid: string): Observable<ResponseMatrixDto> {
    return this.httpService.get<ResponseMatrixDto>(`${this.baseUrl}/Matrix/${surveyGuid}`);
  }

  getAnalytics(surveyGuid: string): Observable<SurveyAnalyticsDto> {
    return this.httpService.get<SurveyAnalyticsDto>(`${this.baseUrl}/Analytics/${surveyGuid}`);
  }
}