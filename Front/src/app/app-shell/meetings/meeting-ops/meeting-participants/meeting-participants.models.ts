import { MeetingMember } from '../../../../core/models/Meeting';

// به‌روزرسانی interface MemberIdentity
export interface MemberIdentity {
  id: string;
  type: 'system' | 'board' | 'external';
  sourceId: string; // composite برای validate/uniqueness
  userKey: string; // baseUserGuid یا boardGuid برای duplicate/conflict
  displayName: string;
  position: string;
  positionGuid?: string;
  image?: string;
  isSystem?: boolean;
}

export interface ProcessedMember extends MeetingMember {
  identity: MemberIdentity;
  isValidated: boolean; // آیا با منبع اصلی sync شده
}

/** انواع تداخل قابل نمایش برای هر عضو */
export type MemberConflictType = 'Meeting' | 'Leave' | 'BlockedTime' | 'GuestInfo';

/** نوع فایل‌های قابل آپلود برای مهمان */
export type GuestFileType = 'profile' | 'signature';

/** پوشه آپلود فایل‌های مهمان */
export const GUEST_UPLOAD_FOLDER = 'Meeting{{Folder}}Guests{{Folder}}Temp';

/** تصویر پیش‌فرض اعضا */
export const DEFAULT_AVATAR = 'img/default-avatar.png';
