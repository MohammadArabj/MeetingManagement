

import { Injectable, signal, computed, effect } from '@angular/core';
import { MeetingMember } from '../../../core/models/Meeting';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { USER_ID_NAME } from '../../../core/types/configuration';
import { MeetingRoles } from '../../../core/meeting-access/meeting-roles';

@Injectable({
  providedIn: 'root'
})
export class MeetingBehaviorService {

  private _meeting = signal<any>(null);
  meeting = this._meeting.asReadonly();
  private _isBoardMeeting = signal<boolean>(false);
  isBoardMeeting = this._isBoardMeeting.asReadonly();

  private _members = signal<MeetingMember[]>([]);
  members = this._members.asReadonly();

  private _currentMember = signal<any | null>(null);
  currentMember = this._currentMember.asReadonly();

  private _resolutions = signal<any>(null);
  resolutions = this._resolutions.asReadonly();

  constructor(private readonly localStorageService: LocalStorageService) {
    effect(() => {
      this._members();
      this.updateCurrentMember();
    });
  }

  setBoardMeetingResult(result: boolean) {
    this._isBoardMeeting.set(result);
  }

  getBoardMeetingResultValue(): boolean {
    return this._isBoardMeeting();
  }

  setResolutions(meeting: any) {
    this._resolutions.set(meeting);
  }

  updateResolutions(updateResolutions: any) {
    const currentResolutions = this._resolutions();
    if (currentResolutions) {
      this._resolutions.set(updateResolutions);
    }
  }

  hasChairmanSigned(): boolean {
    const meeting = this._meeting();
    const members = this._members();

    if (!meeting || !members) return false;

    // پیدا کردن رئیس جلسه (roleId = 3)
    const chairman = members.find(m => MeetingRoles.isChairman(m.roleId));

    if (!chairman) return false;

    // بررسی وضعیت امضا رئیس
    return chairman.isSign === true;
  }
  getMembersValue(): MeetingMember[] {
    return this._members();
  }
  setMembers(members: MeetingMember[]) {
    members.forEach(member => {
      const delegate = members.find(m => m.userGuid === member.replacementUserGuid);
      if (delegate) {
        delegate.isDelegate = true;
      }
      else {
        member.isDelegate = false;
      }
    });
    this._members.set(members);
    this.updateCurrentMember();
  }

  updateMember(updatedMember: Partial<any>, index: number) {
    this._members.update(currentMembers => {
      if (currentMembers && currentMembers[index]) {
        const newMembers = [...currentMembers];
        newMembers[index] = { ...newMembers[index], ...updatedMember };
        return newMembers;
      }
      return currentMembers;
    });
    this.updateCurrentMember();
  }

  setMeeting(meeting: any) {
    this._meeting.set(meeting);
  }

  updateMeeting(updatedData: Partial<any>) {
    this._meeting.update(currentMeeting => {
      if (currentMeeting) {
        return { ...currentMeeting, ...updatedData };
      }
      return currentMeeting;
    });
  }

  updateMembers(updatedMembers: MeetingMember[]) {
    this._members.set(updatedMembers);
    this.updateCurrentMember();
  }

  setCurrentMember(member: MeetingMember) {
    this._currentMember.set(member);
  }

  private updateCurrentMember() {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    if (!userGuid) {
      this._currentMember.set(null);
      return;
    }
    const members = this._members();
    const currentMember = members.find(m => m.userGuid === userGuid);
    this._currentMember.set(currentMember || null);
  }
  // ============= Date Validation =============

  /**
   * تبدیل تاریخ شمسی به عدد قابل مقایسه
   * فرمت: 1404/10/21 -> 14041021
   */
  private normalizePersianDate(dateStr: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split('/').map(p => p.padStart(2, '0'));
    return parseInt(parts.join(''), 10);
  }

  /**
   * گرفتن تاریخ امروز به فرمت شمسی
   */
  private getTodayPersian(): string {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // تبدیل ارقام فارسی به انگلیسی
    return formatter.format(today)
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  }

  /**
   * بررسی اینکه آیا تاریخ جلسه رسیده است یا خیر
   * @returns true اگر تاریخ جلسه امروز یا قبل از امروز باشد
   */
  canHoldMeeting(): boolean {
    const meeting = this._meeting();
    if (!meeting) return false;

    const meetingDate = meeting.mtDate;
    if (!meetingDate) return true;

    const today = this.getTodayPersian();
    const meetingDateNum = this.normalizePersianDate(meetingDate);
    const todayNum = this.normalizePersianDate(today);

    return meetingDateNum <= todayNum;
  }

  /**
   * گرفتن تاریخ جلسه
   */
  getMeetingDate(): string {
    const meeting = this._meeting();
    return meeting?.mtDate || '';
  }

  // ============= Chairman & Secretary Validation =============

  /**
   * بررسی اینکه آیا رئیس یا دبیر غایب و بدون جانشین هستند
   * @returns { canFinalize: boolean; errors: string[] }
   */
  canFinalizeRegistration(): { canFinalize: boolean; errors: string[] } {
    const members = this._members();
    const errors: string[] = [];

    if (!members || members.length === 0) {
      return { canFinalize: false, errors: ['اطلاعات اعضا بارگذاری نشده است'] };
    }

    // پیدا کردن رئیس جلسه (roleId = 3)
    const chairman = members.find(m => MeetingRoles.isChairman(m.roleId));

    // پیدا کردن دبیر جلسه (roleId = 1) - دبیر غیرعضو (roleId = 2) حساب نمی‌شود
    const secretary = members.find(m => MeetingRoles.isSecretary(m.roleId));

    // بررسی رئیس جلسه
    if (chairman) {
      const isChairmanAbsent = chairman.isPresent === false;
      const hasSubstitute = !!chairman.replacementUserGuid;

      if (isChairmanAbsent && !hasSubstitute) {
        errors.push('رئیس جلسه غایب است و جانشین ندارد');
      }
    }

    // بررسی دبیر جلسه
    if (secretary) {
      const isSecretaryAbsent = secretary.isPresent === false;
      const hasSubstitute = !!secretary.replacementUserGuid;

      if (isSecretaryAbsent && !hasSubstitute) {
        errors.push('دبیر جلسه غایب است و جانشین ندارد');
      }
    }

    return {
      canFinalize: errors.length === 0,
      errors
    };
  }
}
