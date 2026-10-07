import { AgendaItem, MeetingMember } from '../../../core/models/Meeting';

// ===== DTO های ارسال به سرور =====
export interface CreateMeetingDto {
  guid?: string;
  title: string;
  categoryGuid?: string;
  roomGuid?: string;
  roomName?: string;
  roomLink?: string;
  number?: string;
  date: string;
  startTime: string;
  endTime: string;
  followGuid?: string;
  notAllowReplacement: boolean;
  statusId: number;
  sendNotification: boolean;
  isBoardMeeting: boolean;
  creatorPositionGuid?: string;
  agendas: AgendaItem[];
  members: MeetingMemberDto[];
}

export interface MeetingMemberDto {
  id: number;
  name: string;
  isExternal: boolean;
  isRemoved: boolean;
  roleId: number;
  userGuid?: string;
  positionGuid?: string;
  persNo?: string;
  boardMemberGuid?: string;
  mobile?: string;
  email?: string;
  organization?: string;
  gender?: string;
  profileGuid?: string;   // ✅ GUID فایل
  signatureGuid?: string; // ✅ GUID فایل
}

// ===== INTERFACES =====
export interface MeetingFormData {
  guid: string;
  title: string;
  categoryGuid: string;
  roomGuid: string;
  roomName: string;
  roomLink: string;
  number: string;
  locationType: string;
  date: string;
  startTime: string;
  endTime: string;
  followGuid: string;
  notAllowReplacement: boolean;
}

export interface LoadedMeetingData {
  meeting: any;
  members: MeetingMember[];
  agendas: any[];
}

/** نگهداری فایل‌های انتخاب‌شده برای هر عضو (پروفایل / امضا) */
export type MemberFileStorage = { [key: string]: { profile?: File; signature?: File } };

// ===== CONSTANTS =====
export const LOCATION_TYPES = [
  { guid: 'internal', title: 'حضوری درون شرکت' },
  { guid: 'external', title: 'بیرون از شرکت' },
  { guid: 'online', title: 'آنلاین' },
];

/** تصویر پیش‌فرض اعضا */
export const DEFAULT_AVATAR = 'img/default-avatar.png';
