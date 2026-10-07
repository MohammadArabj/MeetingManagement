// services/blocked-time.service.ts
import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { RequestConfig } from './framework-services/http.service';
import { Observable } from 'rxjs';

export interface CreateBlockedTimeDto {
  date: string;
  startTime: string;
  endTime: string;
  userGuid: string;
  description?: string;
}

export interface UpdateBlockedTimeDto {
  guid: string;
  userGuid: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export interface BlockedTimeDto {
  id: number;
  guid: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  createdAt: string;
}

export interface CheckAvailabilityDto {
  positionGuid: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface CheckMultipleAvailabilityDto {
  positionGuids: string[];
  date: string;
  startTime: string;
  endTime: string;
}

export interface AvailabilityResultDto {
  positionGuid: string;
  isAvailable: boolean;
  conflictDescription?: string;
  blockedFrom?: string;
  blockedTo?: string;
}

export interface MultipleAvailabilityResultDto {
  results: AvailabilityResultDto[];
  allAvailable: boolean;
  conflicts: AvailabilityResultDto[];
}

@Injectable({
  providedIn: 'root'
})
export class BlockedTimeService extends ServiceBase {

  constructor() {
    super('BlockedTime');
  }

  /**
   * دریافت لیست زمان‌های عدم حضور
   */
  getListByPosition(positionGuid: string): Observable<any> {
    const path = `${this.baseUrl}/List/${positionGuid}`;
    return this.httpService.getAll<BlockedTimeDto[]>(path);
  }

  /**
   * دریافت زمان‌های عدم حضور برای تقویم
   */
  getForCalendar(positionGuid: string, fromDate?: string, toDate?: string): Observable<any> {
    let path = `${this.baseUrl}/Calendar/${positionGuid}`;
    const params: string[] = [];

    if (fromDate) params.push(`fromDate=${fromDate}`);
    if (toDate) params.push(`toDate=${toDate}`);

    if (params.length > 0) {
      path += `?${params.join('&')}`;
    }

    return this.httpService.getAll<BlockedTimeDto[]>(path);
  }

  /**
   * ایجاد زمان عدم حضور
   */
  createBlockedTime(dto: CreateBlockedTimeDto): Observable<any> {
    const path = `${this.baseUrl}/Create`;
    return this.httpService.post<BlockedTimeDto>(path, dto, new RequestConfig({ submitted: true }));
  }

  /**
   * ویرایش زمان عدم حضور
   */
  updateBlockedTime(dto: UpdateBlockedTimeDto): Observable<any> {
    const path = `${this.baseUrl}/Update`;
    return this.httpService.post<BlockedTimeDto>(path, dto, new RequestConfig({ submitted: true }));
  }

  /**
   * حذف زمان عدم حضور
   */
  deleteBlockedTime(guid: string): Observable<any> {
    const path = `${this.baseUrl}/Delete/${guid}`;
    return this.httpService.delete(path, new RequestConfig({ noValidate: true }),false);
  }

  /**
   * بررسی در دسترس بودن یک کاربر
   */
  checkAvailability(dto: CheckAvailabilityDto): Observable<any> {
    const path = `${this.baseUrl}/CheckAvailability`;
    return this.httpService.post<AvailabilityResultDto>(path, dto, new RequestConfig({ noValidate: true, submitted: false }), false);
  }

  /**
   * بررسی در دسترس بودن چند کاربر
   */
  checkMultipleAvailability(dto: CheckMultipleAvailabilityDto): Observable<any> {
    const path = `${this.baseUrl}/CheckMultipleAvailability`;
    return this.httpService.post<MultipleAvailabilityResultDto>(path, dto, new RequestConfig({ noValidate: true, submitted: false }), false);
  }
}