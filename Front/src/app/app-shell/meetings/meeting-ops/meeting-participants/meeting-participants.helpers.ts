import { FormGroup } from '@angular/forms';

import { MeetingMember } from '../../../../core/models/Meeting';
import { SystemUser } from '../../../../core/models/User';
import { ConflictItem } from '../../../../core/types/conflict-result';
import { ComboBase } from '../../../../shared/combo-base';
import { generateGuid } from '../../../../core/types/configuration';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';
import { environment } from '../../../../../environments/environment';
import { DEFAULT_AVATAR, MemberConflictType, MemberIdentity, ProcessedMember } from './meeting-participants.models';

// ═══════════════════════════════════════════════════════════
// توابع کمکی خالص برای مدیریت اعضای جلسه
// ═══════════════════════════════════════════════════════════

// ===== تصاویر =====
export function getSystemUserImage(user: SystemUser): string {
  return user.userName
    ? `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${user.userName}.jpg`)}&w=48&q=75`
    : DEFAULT_AVATAR;
}

// ===== نقش‌ها =====
export function getDefaultRoles(): ComboBase[] {
  return [
    { id: 1, title: 'رئیس جلسه', other: '#dc3545' },
    { id: 2, title: 'دبیر', other: '#0d6efd' },
    { id: 3, title: 'عضو', other: '#198754' },
    { id: 4, title: 'ناظر', other: '#fd7e14' },
    { id: 5, title: 'مشاور', other: '#6f42c1' },
    { id: 6, title: 'مهمان', other: '#6c757d' }
  ];
}

export function getRoleColor(roles: ComboBase[], roleId: number): string {
  return roles.find(role => role.id === roleId)?.other || '#6c757d';
}

export function getRoleTitle(roles: ComboBase[], roleId: number): string {
  return roles.find(role => role.id === roleId)?.title || 'نامشخص';
}

// ===== کلیدها و شناسه‌ها =====

// بهبود getUserCompositeKey برای سازگاری بیشتر
export function getUserCompositeKey(user: SystemUser): string {
  // اگر کاربر positionGuid مستقیم دارد
  if (user.positionGuid) {
    return `${user.guid}_${user.positionGuid}`;
  }

  // اگر در positions دارد
  if (user.positions && user.positions.length > 0) {
    const firstPosition = user.positions[0];
    return firstPosition.positionGuid
      ? `${user.guid}_${firstPosition.positionGuid}`
      : user.guid;
  }

  // اگر هیچ سمتی ندارد
  return user.guid;
}

/** sourceId اعضای فعال (حذف‌نشده) - composite برای جلوگیری از duplicate سمت */
export function getActiveSourceIds(members: ProcessedMember[]): Set<string> {
  return new Set(
    members
      .filter(m => !m.isRemoved)
      .map(m => m.identity.sourceId)
  );
}

/**
 * فیلتر کاربران برای dropdown ها: انتخاب‌نشده و منطبق با عبارت جستجو
 * @param keyOf کلید مقایسه با sourceId اعضای فعال
 */
export function filterSelectableUsers(
  users: SystemUser[],
  activeIds: Set<string>,
  query: string,
  keyOf: (user: SystemUser) => string
): SystemUser[] {
  return users.filter(user => {
    const fullText = `${user.name} ${user.userName || ''} ${user.position}`.toLowerCase();
    const compositeKey = keyOf(user);
    const isNotSelected = !activeIds.has(compositeKey);
    const matchesQuery = !query || fullText.includes(query);

    return isNotSelected && matchesQuery;
  });
}

// اصلاح createMemberIdentity برای حفظ بهتر اطلاعات
export function createMemberIdentity(member: MeetingMember): MemberIdentity {
  if (member.isExternal) {
    return {
      id: member.guid || generateGuid(),
      type: 'external',
      sourceId: member.guid || generateGuid(),
      userKey: member.guid || generateGuid(), // برای external همان guid
      displayName: member.name,
      position: member.organization || member.position || ''
    };
  }

  if (member.boardMemberGuid) {
    return {
      id: member.guid || generateGuid(),
      type: 'board',
      sourceId: member.boardMemberGuid,
      userKey: member.boardMemberGuid, // board key همان guid
      displayName: member.name,
      position: member.position || ''
    };
  }

  // System user - ساخت composite key دقیق
  const baseGuid = member.userGuid || member.guid || generateGuid();
  const posGuid = member.positionGuid || '';

  return {
    id: member.guid || generateGuid(),
    type: 'system',
    sourceId: posGuid ? `${baseGuid}_${posGuid}` : baseGuid, // composite فقط اگر سمت داشته باشد
    userKey: baseGuid, // اصلی
    displayName: member.name,
    position: member.position || '',
    positionGuid: posGuid
  };
}

// به‌روزرسانی createNewMemberFromUser
export function createNewMemberFromUser(user: SystemUser, identity: MemberIdentity): ProcessedMember {
  const baseMember: MeetingMember = {
    id: 0,
    guid: identity.id,
    name: identity.displayName,
    position: identity.position,
    roleId: MeetingRoles.member,
    isExternal: false,
    isRemoved: false,
    image: identity.image ?? DEFAULT_AVATAR,
    userGuid: identity.userKey, // اصلی! (baseUserGuid)
    positionGuid: user.positionGuid,
    userName: user.userName
  };
  if (identity.type === 'board') {
    baseMember.boardMemberGuid = identity.sourceId;
    delete baseMember.userGuid;
  }
  return {
    ...baseMember,
    identity,
    isValidated: true
  };
}

// ===== مرتب‌سازی و مقایسه =====
export function sortMembers(members: ProcessedMember[]): void {
  const rolePriority: { [key: number]: number } = {
    6: 1, 3: 2, 1: 3, 2: 4, 4: 5, 5: 6
  };

  // members.sort((a, b) => {
  //   const priorityA = rolePriority[a.roleId] || 999;
  //   const priorityB = rolePriority[b.roleId] || 999;

  //   if (priorityA !== priorityB) {
  //     return priorityA - priorityB;
  //   }

  //   return a.name.localeCompare(b.name, 'fa');
  // });
  members.sort((a, b) => rolePriority[a.roleId || 999] - rolePriority[b.roleId || 999]);
}

export function areMembersEqual(member1: ProcessedMember, member2: ProcessedMember): boolean {
  return member1.name === member2.name &&
    member1.position === member2.position &&
    member1.roleId === member2.roleId &&
    member1.isRemoved === member2.isRemoved &&
    member1.identity.sourceId === member2.identity.sourceId;
}

// متد کمکی برای تشخیص تغییرات واقعی
export function hasRealMemberChanges(oldMembers: ProcessedMember[], newMembers: ProcessedMember[]): boolean {
  if (oldMembers.length !== newMembers.length) {
    return true;
  }

  for (let i = 0; i < oldMembers.length; i++) {
    const oldMember = oldMembers[i];
    const newMember = newMembers[i];

    // بررسی فیلدهای کلیدی
    if (oldMember.guid !== newMember.guid ||
      oldMember.name !== newMember.name ||
      oldMember.position !== newMember.position ||
      oldMember.roleId !== newMember.roleId ||
      oldMember.isRemoved !== newMember.isRemoved ||
      oldMember.identity.sourceId !== newMember.identity.sourceId) {
      return true;
    }
  }

  return false;
}

export function hasDataChanged(member: ProcessedMember, currentData: any): boolean {
  if (member.identity.type === 'system') {
    return member.name !== currentData.name ||
      member.position !== currentData.position;
  } else if (member.identity.type === 'board') {
    return member.name !== currentData.fullName ||
      member.position !== (currentData.position || '');
  }

  return false;
}

/** حذف identity از object قبل از emit (چون parent component نیازی نداره) */
export function toPlainMembers(members: ProcessedMember[]): MeetingMember[] {
  return members.map(member => {
    const { identity, isValidated, ...memberData } = member;
    return memberData;
  });
}

// ===== تداخل‌ها =====

/** جزئیات تداخل یک عضو از نوع مشخص (بر اساس userGuid یا boardMemberGuid) */
export function findMemberConflict(
  conflicts: ConflictItem[],
  member: ProcessedMember,
  conflictType: MemberConflictType
): ConflictItem | undefined {
  const memberId = member.identity.type === 'system' ? member.userGuid :
    member.identity.type === 'board' ? member.boardMemberGuid : null;

  return memberId ? conflicts.find(conflict =>
    conflict.guid === memberId && conflict.type === conflictType
  ) : undefined;
}

export function hasMemberConflict(
  conflicts: ConflictItem[],
  member: ProcessedMember,
  conflictType: MemberConflictType
): boolean {
  const memberId = member.identity.type === 'system' ? member.userGuid :
    member.identity.type === 'board' ? member.boardMemberGuid : null;
  return memberId ? conflicts.some(conflict =>
    conflict.guid === memberId && conflict.type === conflictType
  ) : false;
}

// ===== فرم =====
export function markFormGroupTouched(formGroup: FormGroup): void {
  Object.keys(formGroup.controls).forEach(key => {
    const control = formGroup.get(key);
    if (control) {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        markFormGroupTouched(control);
      }
    }
  });
}

/** پاک کردن مقدار input های فایل مهمان (پروفایل و امضا) */
export function clearGuestFileInputs(): void {
  const profileInput = document.getElementById('profile') as HTMLInputElement;
  const signatureInput = document.getElementById('signature') as HTMLInputElement;
  if (profileInput) profileInput.value = '';
  if (signatureInput) signatureInput.value = '';
}
