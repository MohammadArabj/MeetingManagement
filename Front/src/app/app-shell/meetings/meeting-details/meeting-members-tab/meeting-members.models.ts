import { ComboBase } from '../../../../shared/combo-base';
import { SystemUser } from '../../../../core/models/User';

// ═══════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════

export interface MemberListItem {
  id: number;
  guid?: string;
  name: string;
  userGuid?: string;
  boardMemberGuid?: string;
  positionGuid?: string;
  userName?: string;
  position?: string;
  roleId: number;
  role?: string;
  roleColor?: string;
  isExternal: boolean;
  isPresent?: boolean | null;
  isAttendance?: boolean | null;
  isSign: boolean;
  comment?: string;
  email?: string;
  mobile?: string;
  organization?: string;
  gender?: string;
  replacementUserGuid?: string;
  replacementName?: string;
  profileGuid?: string;
  signatureGuid?: string;
  signer?: string;
  signerName?: string;
  signerUserName?: string;
  image?: string;
  isRemoved: boolean;
}

export interface MemberFormData {
  userGuid: string;
  positionGuid: string;
  roleId: number;
  persNo?: string;
}

export interface GuestFormData {
  guestType: 'internal' | 'external';
  // Internal
  selectedUserGuid?: string;
  selectedPositionGuid?: string;
  // External
  name?: string;
  mobile?: string;
  email?: string;
  organization?: string;
  gender?: 'Male' | 'Female';
  profileGuid?: string;
  signatureGuid?: string;
}

export interface SubstituteFormData {
  memberId: number;
  memberName: string;
  replacementUserGuid: string;
  replacementPositionGuid?: string;
  persNo?: string;
}

export interface SignatureFormData {
  memberId: number;
  memberName: string;
  comment: string;
  isSign: boolean;
  signatureImage?: string;
}

export interface MeetingSummary {
  total: number;
  internal: number;
  external: number;
  present: number;
  absent: number;
  unknown: number;
  signed: number;
  announced: number;
  withSubstitute: number;
}

// ═══════════════════════════════════════════════════════════════
// Child component event payloads
// ═══════════════════════════════════════════════════════════════

/** خروجی مودال افزودن عضو */
export interface AddMemberSaveEvent {
  selectedUser: SystemUser;
  roleId: number;
}

/** خروجی مودال افزودن مهمان (بدنه درخواست بدون meetingGuid) */
export interface AddGuestSaveEvent {
  roleId: number;
  isExternal: boolean;
  userGuid?: string;
  positionGuid?: string;
  name?: string;
  persNo?: string;
  mobile?: string;
  email?: string;
  organization?: string;
  gender?: string;
  profileGuid?: string | null;
  signatureGuid?: string | null;
}

/** خروجی مودال انتخاب جانشین */
export interface SubstituteSaveEvent {
  member: MemberListItem;
  selectedUser: SystemUser;
}

/** خروجی مودال ثبت نظر و امضا */
export interface SignatureSaveEvent {
  member: MemberListItem;
  isSign: boolean;
  comment: string;
}

/** کال‌بک‌های ستون‌های گرید اعضا */
export interface MembersGridHandlers {
  onDelete: (member: MemberListItem) => void;
  onSubstitute: (member: MemberListItem) => void;
  onSign: (member: MemberListItem) => void;
  canSign: (member: MemberListItem) => boolean;
  onRemoveSubstitute: (member: MemberListItem) => void;
  onPresenceChange: (member: MemberListItem, isPresent: boolean) => void;
}

// ═══════════════════════════════════════════════════════════════
// Role Configuration
// ═══════════════════════════════════════════════════════════════

export const ROLES: ComboBase[] = [
  { id: 1, guid: '1', title: 'دبیر', other: '#0d6362' },
  { id: 2, guid: '2', title: 'دبیر غیر عضو', other: '#3edb1f' },
  { id: 3, guid: '3', title: 'رئیس', other: '#5c3028' },
  { id: 4, guid: '4', title: 'ناظر', other: '#835dbb' },
  { id: 5, guid: '5', title: 'عضو عادی', other: '#c27114' },
  { id: 6, guid: '6', title: 'مهمان', other: '#533cc8' },
];
