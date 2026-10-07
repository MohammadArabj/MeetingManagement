import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RequestConfig } from './framework-services/http.service';
import { ServiceBase } from './framework-services/service.base';

// ==================== INTERFACES ====================
export interface QuestionListDto {
  guid: string;
  questionText: string;
  questionType: string;
  questionTypeEnum: number;
  sortOrder: number;
  isRequired: boolean;
  helpText?: string;
  totalOptions: number;
  hasLogic: boolean;
}

export interface QuestionDetailDto {
  guid: string;
  questionText: string;
  questionType: number;
  showType: number;
  sortOrder: number;
  isRequired: boolean;
  helpText?: string;
  placeholder?: string;
  randomizeOptions: boolean;
  allowOtherOption: boolean;
  otherOptionText?: string;
  imageUrl?: string;
  videoUrl?: string;
  validationType?: number;
  validationErrorMessage?: string;
  customValidationRegex?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  minSelections?: number;
  maxSelections?: number;
  maxFileSize?: number;
  allowedFileTypes?: string;
  minScaleLabel?: string;
  maxScaleLabel?: string;
  matrixRows?: string[];
  matrixColumns?: string[];
  options: QuestionOptionDetailDto[];
  logics: QuestionLogicDetailDto[];
  changed?: boolean;
  criterionGuid?: string;
}

export interface QuestionOptionDetailDto {
  guid: string;
  optionText: string;
  sortOrder: number;
  value?: string;
  imageUrl?: string;
  color?: string;
}

export interface QuestionLogicDetailDto {
  id: number;
  targetQuestionGuid: string;
  logicType: string;
  logicTypeEnum: number;
  conditionOperator: string;
  conditionOperatorEnum: number;
  conditionValue?: string;
  optionGuid?: string;
  priority: number;
}

export interface QuestionStatisticsDto {
  questionGuid: string;
  questionText: string;
  questionType: number;
  totalAnswers: number;
  skippedCount: number;
  optionStats?: OptionStatDto[];
  average?: number;
  min?: number;
  max?: number;
  textAnswers?: string[];
}

export interface OptionStatDto {
  optionId: number;
  optionText: string;
  count: number;
  percentage: number;
}

export interface CreateOrEditQuestionDto {
  guid?: string;
  surveyGuid: string;
  questionText: string;
  questionType: number;
  sortOrder: number;
  isRequired: boolean;
  helpText?: string;
  placeholder?: string;
  randomizeOptions?: boolean;
  allowOtherOption?: boolean;
  otherOptionText?: string;
  imageUrl?: string;
  videoUrl?: string;
  validationType?: number;
  validationErrorMessage?: string;
  customValidationRegex?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  minSelections?: number;
  maxSelections?: number;
  maxFileSize?: number;
  allowedFileTypes?: string;
  minScaleLabel?: string;
  maxScaleLabel?: string;
  matrixRows?: string[];
  matrixColumns?: string[];
  options?: CreateQuestionOptionDto[];
  logics?: CreateQuestionLogicDto[];
}

export interface CreateQuestionOptionDto {
  optionText: string;
  sortOrder: number;
  value?: string;
  imageUrl?: string;
  color?: string;
}

export interface CreateQuestionLogicDto {
  targetQuestionGuid?: string;
  logicType: number;
  conditionOperator: number;
  conditionValue?: string;
  optionGuid?: string;
  priority?: number;
}

export interface ReorderQuestionsDto {
  surveyGuid: string;
  questionOrders: { guid: string; sortOrder: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class QuestionService extends ServiceBase {
  constructor() {
    super('Question');
  }

  // ==================== GET LIST ====================
  getListBySurvey(surveyGuid: string): Observable<QuestionListDto[]> {
    const path = `${this.baseUrl}/List/${surveyGuid}`;
    return this.httpService.get<QuestionListDto[]>(path);
  }

  // ==================== GET DETAIL ====================
  getDetail(guid: string): Observable<QuestionDetailDto> {
    const path = `${this.baseUrl}/GetDetail/${guid}`;
    return this.httpService.get<QuestionDetailDto>(path);
  }

  // ==================== GET FOR RESPONSE ====================
  getQuestionsForResponse(surveyGuid: string, includeLogic: boolean = true): Observable<QuestionDetailDto[]> {
    const path = `${this.baseUrl}/ForResponse/${surveyGuid}`;
    return this.httpService.get<QuestionDetailDto[]>(path);
  }

  // ==================== STATISTICS ====================
  getStatistics(questionGuid: string): Observable<QuestionStatisticsDto> {
    const path = `${this.baseUrl}/${questionGuid}/Statistics`;
    return this.httpService.get<QuestionStatisticsDto>(path);
  }

  // ==================== CREATE OR EDIT ====================
  createOrEdit(question: CreateOrEditQuestionDto): Observable<{ guid: string }> {
    const path = `${this.baseUrl}/CreateOrEdit`;
    return this.httpService.post<{ guid: string }>(path, question);
  }

  // ==================== DELETE ====================
  deleteQuestion(guid: string): Observable<boolean> {
    return this.delete(guid) as Observable<boolean>;
  }

  // ==================== REORDER ====================
  reorderQuestions(reorderData: ReorderQuestionsDto): Observable<boolean> {
    const path = `${this.baseUrl}/Reorder`;
    return this.httpService.post<boolean>(path, reorderData);
  }
}