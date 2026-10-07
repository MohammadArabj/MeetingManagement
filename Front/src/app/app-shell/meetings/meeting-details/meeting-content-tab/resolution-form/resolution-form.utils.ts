import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import moment from 'jalali-moment';

import { SystemUser } from '../../../../../core/models/User';
import { Resolution } from '../../../../../core/models/Resolution';
import { fixPersianDigits, normalizePersian } from '../../../../../core/types/configuration';
import { environment } from '../../../../../../environments/environment';
import { AppSettings } from '../../../../../services/system-setting.service';

import {
  AgendaFileInfo,
  AssignmentItemDto,
  BoardAssignmentItemDto,
  CreateResolutionBoardMeetingDto,
  EMPTY_GUID,
  FileItem,
  ResolutionFileDto,
  UserWithPosition,
} from './resolution-form.models';

// ═══════════════════════════════════════════════════════════
// Generic helpers
// ═══════════════════════════════════════════════════════════

export function buildUniqueKey(userGuid: string, positionGuid?: string | null): string {
  const pg = (positionGuid ?? '').toString().trim();
  return `${userGuid}_${pg !== '' ? pg : 'empty'}`;
}

export function normalizeValue(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return (v.guid ?? v.value ?? v.id ?? '').toString();
  return v.toString();
}

export function normalizeBoardResult(raw: any): string {
  const r = normalizeValue(raw);
  if (r === '1' || r === '2') return r;
  if (r === 'Done') return '1';
  if (r === 'NotDone') return '2';
  return '';
}

export function normalizeBoardStatus(rawStatus: any, rawResult: any): { status: string; result: string } {
  const s = normalizeValue(rawStatus);
  const r = normalizeValue(rawResult);

  if (s === 'Done' || s === 'NotDone') {
    return { status: '3', result: s === 'Done' ? '1' : '2' };
  }

  if (['1', '2', '3'].includes(s)) {
    return { status: s, result: normalizeBoardResult(r) };
  }

  const sl = s.toLowerCase();
  if (sl === 'inprogress') return { status: '2', result: normalizeBoardResult(r) };
  if (sl === 'pending' || sl === 'waiting') return { status: '1', result: normalizeBoardResult(r) };
  if (sl === 'end' || sl === 'ended' || sl === 'completed') return { status: '3', result: normalizeBoardResult(r) };

  return { status: '1', result: normalizeBoardResult(r) };
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ═══════════════════════════════════════════════════════════
// Dates / validators
// ═══════════════════════════════════════════════════════════

/** آیا تاریخ جلسه (بدون در نظر گرفتن ساعت) قبل از امروز است؟ */
export function isPastDate(meetingDate: Date | string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const m = new Date(meetingDate);
  m.setHours(0, 0, 0, 0);
  return m < today;
}

/** تبدیل تاریخ شمسی (jYYYY/jMM/jDD) به Date میلادی */
export function jalaliToDate(value: string): Date {
  const fixed = fixPersianDigits(value);
  const g = moment(fixed, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
  return new Date(g);
}

/**
 * ساخت ولیدیتور «تاریخ سررسید نباید قبل از تاریخ جلسه باشد».
 * تاریخ جلسه هر بار از getMeetingDate خوانده می‌شود (مقدار فعلی input).
 */
export function futureOrAfterMeetingDateValidator(getMeetingDate: () => Date | string | null): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;

    const inputDate = jalaliToDate(control.value);

    const md = getMeetingDate();
    if (!md) return null;

    const mdStr = typeof md === 'string' ? md : md.toISOString();
    const meetingDateObj = jalaliToDate(mdStr);

    return inputDate < meetingDateObj ? { beforeMeetingDate: true } : null;
  };
}

// ═══════════════════════════════════════════════════════════
// Users / avatars
// ═══════════════════════════════════════════════════════════

export function buildUsersWithPositions(list: SystemUser[]): UserWithPosition[] {
  const res: UserWithPosition[] = [];

  list.forEach(user => {
    if (user.positions?.length) {
      user.positions.forEach(p => {
        res.push({
          userGuid: user.guid,
          userName: user.name,
          positionGuid: p.positionGuid,
          positionTitle: p.positionTitle || '',
          personalNo: user.userName || '',
          uniqueKey: `${user.guid}_${p.positionGuid}`,
        });
      });
    } else {
      res.push({
        userGuid: user.guid,
        userName: user.name,
        positionGuid: '',
        positionTitle: 'بدون سمت',
        personalNo: user.userName || '',
        uniqueKey: `${user.guid}_empty`,
      });
    }
  });

  return res;
}

export function getUserPhotoUrl(personalNo: string): string {
  const photoUrl = encodeURIComponent(`photo/${personalNo}.jpg`);
  return `${environment.fileManagementEndpoint}/api/Image?url=${photoUrl}&w=48&q=75`;
}

export function getUserInitials(userName: string): string {
  if (!userName) return '';
  const words = userName.trim().split(' ');
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

// ═══════════════════════════════════════════════════════════
// Files
// ═══════════════════════════════════════════════════════════

export function revokeBlobUrls(files: FileItem[]): void {
  files.forEach(f => {
    if (f.isBlobUrl && f.url?.startsWith('blob:')) {
      URL.revokeObjectURL(f.url);
    }
  });
}

/** استخراج GUID فایل‌های دستورهای جلسه (هم ساختار files[] و هم fileGuid تکی) */
export function extractAgendaFilesInfo(agendas: any[]): AgendaFileInfo[] {
  const agendaFilesInfo: AgendaFileInfo[] = [];

  agendas.forEach((agenda: any, index: number) => {
    if (Array.isArray(agenda.files)) {
      agenda.files.forEach((f: any) => {
        const g = f.fileGuid;
        if (g && g !== EMPTY_GUID) {
          agendaFilesInfo.push({
            agendaIndex: index + 1,
            agendaText: agenda.text || `دستور جلسه ${index + 1}`,
            fileGuid: g,
          });
        }
      });
    } else if (agenda.fileGuid && agenda.fileGuid !== EMPTY_GUID) {
      agendaFilesInfo.push({
        agendaIndex: index + 1,
        agendaText: agenda.text || `دستور جلسه ${index + 1}`,
        fileGuid: agenda.fileGuid,
      });
    }
  });

  return agendaFilesInfo;
}

export function buildFilesArray(files: FileItem[]): ResolutionFileDto[] {
  return files
    .filter(f => !f.isUploading)
    .filter(f => f.type !== 'loading')
    .filter(f => f.guid || f.fileGuid)
    .map(f => {
      if (f.guid) {
        return {
          id: f.id,
          isRemoved: !!f.isRemoved,
          fileGuid: f.guid
        };
      }
      return {
        id: 0,
        isRemoved: !!f.isRemoved,
        fileGuid: f.fileGuid!
      };
    })
    .filter(x => !!x.fileGuid);
}

// ═══════════════════════════════════════════════════════════
// Assignments - DTO mapping
// ═══════════════════════════════════════════════════════════

/** تبدیل مقدار FormArray تخصیص‌های جلسه عادی به DTO */
export function buildAssignmentsArray(arr: any[]): AssignmentItemDto[] {
  const result: AssignmentItemDto[] = [];

  arr.forEach((a: any) => {
    const validActors = (a.actors || []);
    if (!validActors.length) return;

    result.push({
      actors: validActors.map((x: any) => ({
        id: x.id || 0,
        userGuid: x.actorGuid,
        positionGuid: x.actorPositionGuid || null, // ✅ FIX: '' باعث خطای 400 در Guid سمت سرور می‌شد
        isRemoved: !!x.isRemoved,
      })),
      follower: {
        id: 0,
        userGuid: a.followerGuid,
        positionGuid: a.followerPositionGuid || null,
        isRemoved: false,
      },
      type: a.type,
      dueDate: a.dueDate,
    });
  });

  return result;
}

/** تبدیل مقادیر کنترل‌های تخصیص هیئت مدیره به DTO */
export function buildBoardItemsArray(values: any[]): BoardAssignmentItemDto[] {
  const result: BoardAssignmentItemDto[] = [];

  values.forEach(a => {
    if (!a.id && a.isRemoved) return;

    const actors = (a.actors || []).map((x: any) => ({
      id: x.id || 0,
      userGuid: x.actorGuid || '',
      positionGuid: x.actorPositionGuid || null, // ✅ FIX: '' باعث خطای 400 در Guid سمت سرور می‌شد
      isRemoved: !!x.isRemoved,
    }));

    result.push({
      actors,
      followerGuid: a.followerGuid || AppSettings.boardSecretaryUserGuid,
      followerPositionGuid: a.followerPositionGuid || AppSettings.boardPositionGuid,
      dueDate: a.dueDate || '',
      status: a.status || '1',
      result: a.result || '',
      description: a.description || '',
      isRemoved: !!a.isRemoved,
    });
  });

  return result;
}

// ═══════════════════════════════════════════════════════════
// Board resolution - form <-> DTO
// ═══════════════════════════════════════════════════════════

/** مقادیر اولیه فرم مصوبه هیئت مدیره در حالت ویرایش */
export function boardFormValueFromResolution(res: Resolution): Record<string, any> {
  return {
    id: res.id,
    title: res.title || '',
    number: res.number || '',
    description: res.text || '',
    parentResolutionId: res.parentResolutionId || '',
    committeeMeetingGuid: res.committeeMeetingGuid || '',
    committeeResolutionId: res.committeeResolutionId || '',
    approvedPrice: res.approvedPrice || '',
    contractNumber: res.contractNumber || '',
    documentation: res.documentation || '',
    decisionsMade: res.decisionsMade || '',
  };
}

/** ساخت DTO ذخیره مصوبه هیئت مدیره از مقدار فرم */
export function buildBoardResolutionDto(
  v: any,
  meetingGuid: string,
  files: ResolutionFileDto[],
  items: BoardAssignmentItemDto[],
): CreateResolutionBoardMeetingDto {
  return {
    id: v.id || undefined,
    number: v.number || '',
    title: normalizePersian(v.title) || '',
    description: normalizePersian(v.description) || '',
    decisionsMade: normalizePersian(v.decisionsMade) || '',
    documentation: normalizePersian(v.documentation) || '',
    contractNumber: v.contractNumber || '',
    approvedPrice: v.approvedPrice ? parseFloat(v.approvedPrice) : undefined,
    meetingGuid,
    parentMeetingGuid: v.parentMeetingGuid || undefined,
    parentResolutionId: v.parentResolutionId || undefined,
    committeeMeetingGuid: v.committeeMeetingGuid || undefined,
    committeeResolutionId: v.committeeResolutionId || undefined,
    files,
    items,
  };
}

// ═══════════════════════════════════════════════════════════
// Assignments - grouping existing data (edit)
// ═══════════════════════════════════════════════════════════

/** گروه‌بندی ردیف‌های تخصیص هیئت مدیره (هر actor یک ردیف) به تخصیص‌های واحد */
export function groupBoardAssignments(assignments: any[]): any[] {
  // ✅ FIX 3: کلید گروه‌بندی شامل follower هم میشه
  // قبلاً فقط dueDate+status+result+description بود - چند actor با همون dueDate
  // اما follower متفاوت، اشتباه گروه‌بندی می‌شدند.
  // حالا با اضافه کردن followerGuid+followerPositionGuid به کلید،
  // هر مجموعه‌ی actor که واقعاً یک assignment هستند درست گروه می‌شوند.
  const grouped = assignments.reduce((acc: any, a: any) => {
    const followerGuid = a.followerGuid || AppSettings.boardSecretaryUserGuid || '';
    const followerPositionGuid = a.followerPositionGuid || AppSettings.boardPositionGuid || '';

    const key = [
      followerGuid,
      followerPositionGuid,
      a.dueDate || '',
      a.status || '',
      a.result || '',
      a.description || '',
    ].join('|');

    if (!acc[key]) {
      acc[key] = {
        actors: [],
        dueDate: a.dueDate,
        status: a.status,
        result: a.result,
        description: a.description || '',
        followerGuid,
        followerPositionGuid,
      };
    }
    acc[key].actors.push({
      id: a.id,
      actorGuid: a.actorGuid || '',
      actorPositionGuid: a.actorPositionGuid || '',
      isRemoved: false,
    });
    return acc;
  }, {});

  return Object.values(grouped);
}

/** گروه‌بندی ردیف‌های تخصیص جلسه عادی (هر actor یک ردیف) به تخصیص‌های واحد */
export function groupRegularAssignments(assignments: any[]): any[] {
  const map = new Map<string, any>();

  for (const a of assignments) {
    const type = normalizeValue(a.assignmentType || '');
    const dueDate = normalizeValue(a.dueDate || a.due || '');
    const followerGuid = normalizeValue(a.followerGuid || a.followerUserGuid || '');
    const followerPositionGuid = normalizeValue(a.followerPositionGuid || a.followerPosGuid || '');
    const status = normalizeValue(a.status || '1') || '1';
    const result = normalizeValue(a.result || '');

    const key = `${type}|${dueDate}|${followerGuid}|${followerPositionGuid}|${status}|${result}`;

    if (!map.has(key)) {
      map.set(key, {
        type,
        dueDate,
        followerGuid,
        followerPositionGuid,
        status,
        result,
        actors: [],
      });
    }

    map.get(key).actors.push({
      id: a.id || 0,
      actorGuid: normalizeValue(a.actorGuid || a.userGuid || ''),
      actorPositionGuid: normalizeValue(a.actorPositionGuid || a.positionGuid || ''),
      isRemoved: false,
    });
  }

  return Array.from(map.values());
}
