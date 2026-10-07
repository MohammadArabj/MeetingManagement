import { ElementRef } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Modal } from 'bootstrap';

import { environment } from '../../../../../environments/environment';
import { SystemUser, Position } from '../../../../core/models/User';
import { ComboBase } from '../../../../shared/combo-base';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';
import { MeetingSummary, MemberListItem } from './meeting-members.models';

// ═══════════════════════════════════════════════════════════════
// Images
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_AVATAR = 'img/default-avatar.png';

/** آدرس تصویر پرسنلی کاربر بر اساس نام کاربری */
export function userPhotoUrl(userName: string): string {
  return `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${userName}.jpg`)}&w=48&q=75`;
}

/** آدرس تصویر امضای کاربر */
export function userSignatureUrl(userName: string): string {
  return `${environment.fileManagementEndpoint}/EpcSignature/${userName}.jpg`;
}

// ═══════════════════════════════════════════════════════════════
// Statistics
// ═══════════════════════════════════════════════════════════════

export function computeMeetingSummary(list: MemberListItem[]): MeetingSummary {
  const activeMembers = list.filter(m => !m.isRemoved);

  return {
    total: activeMembers.length,
    internal: activeMembers.filter(m => !m.isExternal).length,
    external: activeMembers.filter(m => m.isExternal).length,
    present: activeMembers.filter(m => m.isPresent === true).length,
    absent: activeMembers.filter(m => m.isPresent === false).length,
    unknown: activeMembers.filter(m => m.isPresent === null || m.isPresent === undefined).length,
    signed: activeMembers.filter(m => m.isSign).length,
    announced: activeMembers.filter(m => m.isAttendance === true).length,
    withSubstitute: activeMembers.filter(m => !!m.replacementUserGuid).length
  };
}

/** آیا رئیس جلسه امضا کرده است */
export function isChairmanSigned(list: MemberListItem[]): boolean {
  return list.some(m => MeetingRoles.isChairman(m.roleId) && m.isSign);
}

// ═══════════════════════════════════════════════════════════════
// Members / Users
// ═══════════════════════════════════════════════════════════════

/** تکمیل تصویر و نام جانشین اعضا (تصاویر پروفایل از طریق loadImage به‌صورت async) */
export function processMembers(
  members: MemberListItem[],
  loadImage: (member: MemberListItem) => void
): MemberListItem[] {
  return members.map(member => {
    // Set image
    if (member.profileGuid) {
      // Will be loaded async
      loadImage(member);
    } else if (member.userName) {
      member.image = userPhotoUrl(member.userName);
    } else {
      member.image = DEFAULT_AVATAR;
    }

    // Find substitute name
    if (member.replacementUserGuid) {
      const substitute = members.find(m => m.userGuid === member.replacementUserGuid);
      member.replacementName = substitute?.name || '';
    }

    return member;
  });
}

/** جایگزینی فیلدهای یک عضو (بر اساس id) در لیست؛ اگر یافت نشود null برمی‌گرداند */
export function patchMember(
  list: MemberListItem[],
  id: number,
  patch: Partial<MemberListItem>
): MemberListItem[] | null {
  const index = list.findIndex(m => m.id === id);
  if (index === -1) return null;
  const updated = [...list];
  updated[index] = { ...updated[index], ...patch };
  return updated;
}

/** هر کاربر با چند سمت، به چند ردیف (یک ردیف برای هر سمت) تبدیل می‌شود */
export function processUsersForMultiPosition(users: SystemUser[]): SystemUser[] {
  return users.flatMap(user => {
    if (user.positions && user.positions.length > 0) {
      return user.positions.map((position: Position) => ({
        ...user,
        guid: `${user.guid}_${position.positionGuid}`,
        baseUserGuid: user.guid,
        positionGuid: position.positionGuid,
        position: position.positionTitle,
        image: user.userName ? userPhotoUrl(user.userName) : DEFAULT_AVATAR
      }));
    }

    return [{
      ...user,
      baseUserGuid: user.guid,
      positionGuid: '',
      position: 'بدون سمت',
      image: user.userName ? userPhotoUrl(user.userName) : DEFAULT_AVATAR
    }];
  });
}

function baseGuidOf(user: SystemUser): string {
  return (user.baseUserGuid || user.guid || '').toLowerCase();
}

function matchesUserQuery(user: SystemUser, query: string): boolean {
  const fullText = `${user.name} ${user.userName || ''} ${user.position || ''}`.toLowerCase();
  return !query || fullText.includes(query);
}

/** کاربرانی که هنوز عضو جلسه نیستند و با عبارت جستجو تطابق دارند */
export function filterUsersNotInMeeting(
  users: SystemUser[],
  members: MemberListItem[],
  rawQuery: string
): SystemUser[] {
  const query = rawQuery.toLowerCase().trim();

  // userGuid های اعضای فعلی
  const memberUserGuids = new Set(
    members
      .filter(m => !m.isRemoved && m.userGuid)
      .map(m => m.userGuid!.toLowerCase())
  );

  return users.filter(user =>
    !memberUserGuids.has(baseGuidOf(user)) && matchesUserQuery(user, query)
  );
}

/** کاربران مجاز برای انتخاب به عنوان جانشین یک عضو */
export function filterSubstituteCandidates(
  users: SystemUser[],
  members: MemberListItem[],
  selectedMember: MemberListItem,
  rawQuery: string
): SystemUser[] {
  const query = rawQuery.toLowerCase().trim();

  // کاربرانی که الان جانشین کسی هستند
  const alreadySubstituteGuids = new Set(
    members
      .filter(m => !m.isRemoved && m.replacementUserGuid)
      .map(m => m.replacementUserGuid!.toLowerCase())
  );

  // خود عضو نباید در لیست باشد
  const selfGuid = (selectedMember.userGuid || '').toLowerCase();

  return users.filter(user => {
    const baseGuid = baseGuidOf(user);
    return baseGuid !== selfGuid && !alreadySubstituteGuids.has(baseGuid) && matchesUserQuery(user, query);
  });
}

/** نقش‌های مجاز برای افزودن عضو (بدون مهمان و با بررسی یکتایی) */
export function filterAvailableRoles(allRoles: ComboBase[], members: MemberListItem[]): ComboBase[] {
  // نقش‌های یکتای موجود
  const existingUniqueRoles = new Set(
    members
      .filter(m => !m.isRemoved && MeetingRoles.isUnique(m.roleId))
      .map(m => m.roleId)
  );

  return allRoles.filter(role => {
    // مهمان رو از لیست حذف کن (برای افزودن عضو)
    if (role.id === 6) return false;
    // اگر نقش یکتا هست و قبلاً اضافه شده، نشون نده
    if (MeetingRoles.isUnique(role.id!) && existingUniqueRoles.has(role.id!)) return false;
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════
// Forms / Modals
// ═══════════════════════════════════════════════════════════════

export function markFormTouched(form: FormGroup): void {
  Object.keys(form.controls).forEach(key => {
    form.get(key)?.markAsTouched();
  });
}

export function showBootstrapModal(modalRef: ElementRef | undefined): void {
  if (modalRef?.nativeElement) {
    const modal = new Modal(modalRef.nativeElement);
    modal.show();
  }
}

export function hideBootstrapModal(modalRef: ElementRef | undefined): void {
  if (modalRef?.nativeElement) {
    const modal = Modal.getInstance(modalRef.nativeElement);
    modal?.hide();
  }
}
