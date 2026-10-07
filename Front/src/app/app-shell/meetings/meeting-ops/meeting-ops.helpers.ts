import { AgendaItem, MeetingMember } from '../../../core/models/Meeting';
import { Position, SystemUser } from '../../../core/models/User';
import { generateGuid } from '../../../core/types/configuration';
import { MeetingRoles } from '../../../core/meeting-access/meeting-roles';
import { environment } from '../../../../environments/environment';
import { AgendaFileDto } from './meeting-agendas/meeting-agendas';
import { CreateMeetingDto, DEFAULT_AVATAR, MeetingMemberDto } from './meeting-ops.models';

// ═══════════════════════════════════════════════════════════
// توابع کمکی خالص (بدون وابستگی به state کامپوننت) برای ثبت جلسه
// ═══════════════════════════════════════════════════════════

// ===== تصاویر =====

/** آدرس تصویر پرسنلی کاربر سیستم بر اساس userName */
export function buildUserPhotoUrl(userName: string): string {
  return `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${userName}.jpg`)}&w=48&q=75`;
}

export function getSystemUserImage(user: SystemUser): string {
  if (user.userName && user.userName.trim() !== '') {
    return buildUserPhotoUrl(user.userName);
  }
  return DEFAULT_AVATAR;
}

export function getDefaultMemberImage(member: MeetingMember, isBoardMeeting: boolean): string {
  if (isBoardMeeting && member.boardMemberGuid) {
    return DEFAULT_AVATAR;
  }

  if (member.userName) {
    return buildUserPhotoUrl(member.userName);
  }

  return DEFAULT_AVATAR;
}

// ===== کاربران =====

// -----------------------------------------------------------------------------
// 1) پیشنهاد: processUsersForMultiPosition را کمی غنی‌تر کنید
// نکته: برای اینکه وضعیت فعال/غیرفعال را داشته باشید، بهتر است در processUsersForMultiPosition
// این فیلد را هم وارد کنید (اگر در SystemUser موجود است).
// -----------------------------------------------------------------------------
export function processUsersForMultiPosition(users: SystemUser[]): SystemUser[] {
  return users.flatMap(user => {
    const userIsActive = (user as any).isActive ?? true; // اگر فیلد دارید، مستقیم user.isActive

    if (user.positions && user.positions.length > 0) {
      return user.positions.map((position: Position) => ({
        guid: `${user.guid}_${position.positionGuid}`,
        name: user.name,
        userName: user.userName,
        positions: [position],
        positionGuid: position.positionGuid,
        position: position.positionTitle,
        image: user.userName
          ? buildUserPhotoUrl(user.userName)
          : DEFAULT_AVATAR,
        isSystem: true,
        baseUserGuid: user.guid,
        // ✅ اضافه
        userIsActive
      } as any));
    }

    // بدون سمت
    return [{
      ...user,
      guid: user.guid,
      positionGuid: '',
      position: 'بدون سمت',
      image: user.userName
        ? buildUserPhotoUrl(user.userName)
        : DEFAULT_AVATAR,
      isSystem: true,
      baseUserGuid: user.guid,
      // ✅ اضافه
      userIsActive
    } as any];
  });
}

// -----------------------------------------------------------------------------
// 2) ایندکس‌ها برای lookup سریع و استخراج عنوان سمت حتی اگر کاربر سمتش را عوض کرده باشد
// -----------------------------------------------------------------------------
export function buildAllUsersIndexes(allUsers: SystemUser[]) {
  // همه رکوردهای composite یک نفر
  const byBaseGuid = new Map<string, SystemUser[]>();

  // مپ عنوان سمت برای هر positionGuid (از کل سازمان)
  const positionTitleByGuid = new Map<string, string>();

  for (const u of allUsers) {
    const base = (u as any).baseUserGuid || u.guid;
    if (!byBaseGuid.has(base)) byBaseGuid.set(base, []);
    byBaseGuid.get(base)!.push(u);

    if (u.positionGuid && u.position) {
      // اگر یک positionGuid چندبار آمد، اولین عنوان کافی است
      if (!positionTitleByGuid.has(u.positionGuid)) {
        positionTitleByGuid.set(u.positionGuid, u.position);
      }
    }
  }

  return { byBaseGuid, positionTitleByGuid };
}

export function pickPreferredEntry(entries: SystemUser[]): SystemUser {
  // اگر منطق اولویت دارید (مثلاً اصلی‌ترین سمت)، اینجا اعمال کنید.
  // فعلاً همان اولین رکورد را برمی‌گردانیم.
  return entries[0];
}

export function resolveMeetingPositionTitle(
  member: MeetingMember,
  positionTitleByGuid: Map<string, string>
): string {
  // 1) اگر بک‌اند عنوان سمت زمان جلسه را داده، همان را نگه دارید
  if (member.position && member.position.trim() !== '') return member.position;

  // 2) اگر فقط positionGuid داریم، عنوان سمت را از مپ کل سمت‌ها پیدا می‌کنیم
  if (member.positionGuid) {
    const t = positionTitleByGuid.get(member.positionGuid);
    if (t && t.trim() !== '') return t;
  }

  // 3) fallback
  return 'سمت نامشخص';
}

// ===== متد ایجاد عضو fallback =====
export async function createFallbackExternalMember(originalMember: MeetingMember): Promise<MeetingMember> {
  return {
    ...originalMember,
    id: 0,
    guid: generateGuid(),
    isExternal: true,
    userGuid: undefined,
    boardMemberGuid: undefined,
    positionGuid: '',
    userName: undefined,
    roleId: MeetingRoles.guest, // مهمان
    organization: originalMember.position || originalMember.organization || 'سازمان نامشخص',
    image: originalMember.image || DEFAULT_AVATAR
  };
}

// ===== اعضا و تداخل‌ها =====

/** شناسه کاربران فعال (حذف‌نشده) لیست اعضا */
function activeUserGuidsOf(members: MeetingMember[]) {
  return members
    .filter(m => !m.isRemoved)
    .map(m => m.userGuid)
    .filter(guid => guid);
}

// ═══════════════════════════════════════════════════════════
// نکته: تداخل‌هایی از نوع "GuestInfo" (یعنی کاربر فقط به
// عنوان "مهمان" در یک جلسه دیگر حضور دارد) صرفاً اطلاع‌رسانی هستند
// و نباید مانع ثبت/ویرایش جلسه شوند. بنابراین این نوع از
// محاسبه hasConflicts کنار گذاشته می‌شود.
// ═══════════════════════════════════════════════════════════
export function hasBlockingConflicts(conflicts: any[], members: MeetingMember[], roomConflict: boolean): boolean {
  const activeUserGuids = activeUserGuidsOf(members);

  // ✅ از conflict.guid استفاده کن (نه conflict.userGuid)
  // و نوع GuestInfo را که فقط جنبه اطلاع‌رسانی دارد، نادیده بگیر
  const activeConflicts = conflicts.filter(conflict =>
    activeUserGuids.includes(conflict.guid) && conflict.type !== 'GuestInfo'
  );

  return activeConflicts.length > 0 || roomConflict;
}

/** ✅ حذف کاربران حذف شده از لیست تداخل‌ها (از conflict.guid استفاده می‌شود) */
export function filterConflictsForMembers(conflicts: any[], members: MeetingMember[]): any[] {
  const activeUserGuids = activeUserGuidsOf(members);
  return conflicts.filter(conflict => activeUserGuids.includes(conflict.guid));
}

// ✅ بررسی تغییر عضویت (نه تغییر نقش)
export function hasMembershipChanged(previous: MeetingMember[], current: MeetingMember[]): boolean {
  const prevActiveGuids = new Set(
    previous.filter(m => !m.isRemoved).map(m => m.userGuid || m.guid)
  );
  const currActiveGuids = new Set(
    current.filter(m => !m.isRemoved).map(m => m.userGuid || m.guid)
  );

  // اگر تعداد متفاوت باشد
  if (prevActiveGuids.size !== currActiveGuids.size) return true;

  // اگر عضو جدیدی اضافه شده یا حذف شده
  for (const guid of currActiveGuids) {
    if (!prevActiveGuids.has(guid)) return true;
  }

  return false;
}

// آماده‌سازی لیست اعضا برای بررسی کانفلیکت - شامل positionGuid
export function buildConflictCheckMembers(members: MeetingMember[]): any[] {
  return members
    .filter(m => !m.isRemoved && MeetingRoles.countsAsMember(m.roleId))
    .map<any>(m => {
      return {
        userGuid: m.userGuid,
        userName: m.userName || '',
        positionGuid: m.positionGuid || null, // ✅ اضافه شد
        boardMemberId: null
      };
    })
    .filter(m => m.userGuid);
}

/** اعضای ارسالی برای دریافت ساعت‌های پیشنهادی */
export function buildSuggestedSlotMembers(members: MeetingMember[]) {
  return members
    .filter(m => !m.isRemoved && MeetingRoles.countsAsMember(m.roleId) && m.userGuid)
    .map(m => ({ userGuid: m.userGuid, userName: m.userName || '', positionGuid: m.positionGuid || null }));
}

// ===== زمان =====

/** مدت جلسه برای ساعت‌های پیشنهادی (بین ۶۰ تا ۱۲۰ دقیقه) */
export function computeSlotDurationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.min(Math.max((eh * 60 + em) - (sh * 60 + sm), 60), 120);
}

/** برش ساعت به قالب HH:mm */
export function formatTime(time: string): string {
  return time ? time.slice(0, 5) : '';
}

/** ایجاد یک key منحصر به فرد برای distinctUntilChanged */
export function buildConflictKey(form: any, membersCount: number): string {
  return `${form.date}-${form.startTime}-${form.endTime}-${form.roomGuid || ''}-${membersCount}`;
}

// ===== ساخت DTO =====

export function sanitizeTitle(value: string): string {
  if (!value) return '';
  // حذف کاراکترهای خاص: " ' ` ^ ~ < > { } [ ] | \ و ...
  return value.replace(/["'`^~<>{}[\]|\\]/g, '').trim();
}

/** ✅ ساخت آرایه agendas */
export function buildAgendaItems(agendaValues: any[]): AgendaItem[] {
  return agendaValues.map(agendaValue => {
    return {
      id: agendaValue.id ?? 0,
      text: agendaValue.text || '',
      isRemoved: agendaValue.isRemoved ?? false,
      files: (agendaValue.files || []).map((file: AgendaFileDto) => ({
        id: file.id ?? 0,
        isRemoved: file.isRemoved ?? false,
        fileGuid: file.fileGuid || ''
      }))
    };
  });
}

/** ✅ ساخت آرایه members */
export function buildMemberDtos(members: MeetingMember[], isEdit: boolean, isBoardMeeting: boolean): MeetingMemberDto[] {
  return members.map(member => {
    const memberDto: MeetingMemberDto = {
      id: member.id ? (isEdit ? member.id : 0) : 0,
      name: member.name,
      isExternal: member.isExternal,
      isRemoved: member.isRemoved ?? false,
      roleId: member.roleId
    };

    // User-specific info
    if (!member.isExternal && member.userGuid) {
      memberDto.userGuid = member.userGuid;
      memberDto.positionGuid = member.positionGuid || undefined;
      memberDto.persNo = member.userName || undefined;
    }

    // Board member specific info
    if (isBoardMeeting && member.boardMemberGuid) {
      memberDto.boardMemberGuid = member.boardMemberGuid;
    }

    // External guest info
    if (member.isExternal) {
      memberDto.mobile = member.mobile || undefined;
      memberDto.email = member.email || undefined;
      memberDto.organization = member.organization || undefined;
      memberDto.gender = member.gender || undefined;
    }

    // ✅ File GUIDs
    if (member.profileGuid) {
      memberDto.profileGuid = member.profileGuid;
    }
    if (member.signatureGuid) {
      memberDto.signatureGuid = member.signatureGuid;
    }

    return memberDto;
  });
}

export interface BuildMeetingDtoParams {
  status: number;
  formValue: any;
  agendaValues: any[];
  members: MeetingMember[];
  isEdit: boolean;
  isBoardMeeting: boolean;
  creatorPositionGuid: string | null | undefined;
}

// ═══════════════════════════════════════════════════════════
// Build DTO Method - جایگزین buildFormData
// ═══════════════════════════════════════════════════════════
export function buildMeetingDto(p: BuildMeetingDtoParams): CreateMeetingDto {
  const formValue = p.formValue;

  // تعیین status و notification
  let statusId = p.status;
  let sendNotification = false;

  if (p.status === 3) {
    sendNotification = true;
    statusId = 2;
  }

  const agendas = buildAgendaItems(p.agendaValues);
  const members = buildMemberDtos(p.members, p.isEdit, p.isBoardMeeting);

  // ✅ ساخت DTO نهایی
  const dto: CreateMeetingDto = {
    guid: formValue.guid || undefined,
    title: sanitizeTitle(formValue.title),
    categoryGuid: formValue.categoryGuid || undefined,
    roomGuid: formValue.roomGuid || undefined,
    roomName: formValue.roomName || undefined,
    roomLink: formValue.roomLink || undefined,
    number: formValue.number || undefined,
    date: formValue.date,
    startTime: formValue.startTime,
    endTime: formValue.endTime,
    followGuid: formValue.followGuid || undefined,
    notAllowReplacement: formValue.notAllowReplacement ?? false,
    statusId: statusId,
    sendNotification: sendNotification,
    isBoardMeeting: p.isBoardMeeting,
    creatorPositionGuid: p.creatorPositionGuid || undefined,
    agendas: agendas,
    members: members
  };

  return dto;
}

/** متن پیام موفقیت ثبت/ویرایش جلسه */
export function buildSubmissionSuccessMessage(isEdit: boolean, response: any): { title: string; text: string } {
  const title = isEdit ? "ویرایش جلسه" : "ثبت جلسه";
  const text = isEdit
    ? "جلسه با موفقیت ویرایش شد"
    : `جلسه با موفقیت ثبت گردید<br>شماره جلسه:<a href="/#/meetings/details/${response.guid}" target="_blank">${response.number}</a>`;
  return { title, text };
}
