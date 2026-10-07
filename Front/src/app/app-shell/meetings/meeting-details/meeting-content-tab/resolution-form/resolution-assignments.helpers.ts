import { AbstractControl, FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';

import { AppSettings } from '../../../../../services/system-setting.service';

import { UserWithPosition } from './resolution-form.models';
import { buildUniqueKey } from './resolution-form.utils';

// ═══════════════════════════════════════════════════════════
// FormGroup factories
// ═══════════════════════════════════════════════════════════

export interface RegularAssignmentValue {
  actors: any[];
  type: string;
  followerGuid: string;
  followerPositionGuid: string;
  followerUniqueKey: string;
  dueDate: string;
  status: string;
  result: string;
}

/** ساخت FormGroup یک تخصیص جلسه عادی (پیش‌فرض: ردیف خالی جدید) */
export function createRegularAssignmentGroup(
  fb: FormBuilder,
  dueDateValidator: ValidatorFn,
  v: RegularAssignmentValue = {
    actors: [],
    type: '',
    followerGuid: '',
    followerPositionGuid: '',
    followerUniqueKey: '',
    dueDate: '',
    status: '1',
    result: '',
  },
): FormGroup {
  return fb.group({
    actors: [v.actors, Validators.required],
    type: [v.type, Validators.required],
    followerGuid: [v.followerGuid, Validators.required],
    followerPositionGuid: [v.followerPositionGuid],
    followerUniqueKey: [v.followerUniqueKey, Validators.required],
    dueDate: [v.dueDate, [Validators.required, dueDateValidator]],
    status: [v.status],
    result: [v.result],
    isRemoved: [false],
  });
}

/** ساخت FormGroup خالی برای یک اقدام کننده جدید هیئت مدیره */
export function createNewBoardAssignmentGroup(fb: FormBuilder): FormGroup {
  return fb.group({
    id: [0],
    actorUniqueKey: [[], Validators.required],
    actors: [[]],
    followerGuid: [AppSettings.boardSecretaryUserGuid || ''],
    followerPositionGuid: [AppSettings.boardPositionGuid || ''],
    dueDate: ['', Validators.required],
    status: ['1'],
    result: [''],
    description: [''],
    isRemoved: [false],
  });
}

// ═══════════════════════════════════════════════════════════
// Actor selection
// ═══════════════════════════════════════════════════════════

/**
 * اعمال انتخاب ng-select «تخصیص یافته به» روی کنترل actors یک ردیف تخصیص عادی.
 * actorهای قبلی که از انتخاب خارج شده‌اند isRemoved می‌شوند و موارد جدید اضافه می‌شوند.
 * @returns کلیدهای فعال (برای همگام‌سازی کنترل ng-select)
 */
export function applyRegularActorsSelection(
  fg: AbstractControl,
  selectedItems: any[],
  usersWithPos: UserWithPosition[],
  editing: boolean,
): string[] {
  const selectedKeys = new Set(
    (selectedItems || []).map((x: any) => typeof x === 'string' ? x : (x.uniqueKey || x))
  );

  const oldActors = fg.get('actors')?.value || [];

  if (selectedKeys.size === 0) {
    if (!editing) {
      fg.get('actors')?.setValue([]);
    } else {
      fg.get('actors')?.setValue(oldActors.map((a: any) => ({ ...a, isRemoved: true })));
    }
  } else {
    let newActors = oldActors.map((a: any) => {
      const key = `${a.actorGuid}_${a.actorPositionGuid}`;
      return { ...a, isRemoved: !selectedKeys.has(key) };
    });

    selectedKeys.forEach(key => {
      const exists = oldActors.some((a: any) => `${a.actorGuid}_${a.actorPositionGuid}` === key);
      if (exists) return;

      const u = usersWithPos.find(p => p.uniqueKey === key);
      if (!u) return;

      newActors.push({
        actorGuid: u.userGuid,
        actorPositionGuid: u.positionGuid,
        id: 0,
        isRemoved: false,
      });
    });

    fg.get('actors')?.setValue(newActors);
  }

  return (fg.get('actors')?.value || [])
    .filter((a: any) => !a.isRemoved)
    .map((a: any) => `${a.actorGuid}_${a.actorPositionGuid}`);
}

/** اعمال انتخاب اقدام کنندگان روی یک ردیف تخصیص هیئت مدیره (actors و actorUniqueKey) */
export function applyBoardActorsSelection(
  group: FormGroup,
  selectedItems: any[],
  usersWithPos: UserWithPosition[],
  editing: boolean,
): void {
  const selectedKeys = new Set<string>((selectedItems || []).map(x => typeof x === 'string' ? x : (x.uniqueKey ?? x)));
  const oldActors: any[] = group.get('actors')?.value || [];

  let newActors = oldActors.map(a => {
    const key = buildUniqueKey(a.actorGuid, a.actorPositionGuid);
    return { ...a, isRemoved: !selectedKeys.has(key) };
  });

  selectedKeys.forEach(key => {
    const exists = oldActors.some(a => buildUniqueKey(a.actorGuid, a.actorPositionGuid) === key);
    if (exists) return;

    const u = usersWithPos.find(p => p.uniqueKey === key);
    if (!u) return;

    newActors.push({ id: 0, actorGuid: u.userGuid, actorPositionGuid: u.positionGuid, isRemoved: false });
  });

  if (!editing) newActors = newActors.filter(a => !a.isRemoved);

  group.get('actors')?.setValue(newActors, { emitEvent: false });

  const activeKeys = newActors.filter(a => !a.isRemoved).map(a => buildUniqueKey(a.actorGuid, a.actorPositionGuid));
  group.get('actorUniqueKey')?.setValue(activeKeys, { emitEvent: false });
}

/**
 * کلیدهای (کاربر_سمت) اعضای فعال جلسه که در لیست کاربران وجود دارند.
 * عضو بدون سمت: همه سمت‌های آن کاربر انتخاب می‌شود.
 */
export function collectMemberKeys(members: any[], usersWithPos: UserWithPosition[]): Set<string> {
  const memberKeys = new Set<string>();

  members.forEach(member => {
    if (member.isRemoved) return;
    if (!member.userGuid) return;

    if (member.positionGuid) {
      const key = `${member.userGuid}_${member.positionGuid}`;
      const existsInUsers = usersWithPos.some(u => u.uniqueKey === key);
      if (existsInUsers) {
        memberKeys.add(key);
      }
    } else {
      usersWithPos
        .filter(u => u.userGuid === member.userGuid)
        .forEach(u => memberKeys.add(u.uniqueKey));
    }
  });

  return memberKeys;
}

// ═══════════════════════════════════════════════════════════
// Removal (edit mode)
// ═══════════════════════════════════════════════════════════

/** علامت‌گذاری یک ردیف تخصیص موجود برای حذف (در حالت ویرایش) و برداشتن ولیدیتورهای آن */
export function markAssignmentRemoved(assignment: AbstractControl): void {
  const actors = assignment.get('actors')?.value || [];
  actors.forEach((actor: any) => {
    actor.isRemoved = true;
  });

  assignment.get('actors')?.setValue(actors);
  assignment.get('isRemoved')?.setValue(true);

  assignment.get('actors')?.clearValidators();
  assignment.get('type')?.clearValidators();
  assignment.get('followerGuid')?.clearValidators();
  assignment.get('followerUniqueKey')?.clearValidators();
  assignment.get('dueDate')?.clearValidators();

  assignment.get('actors')?.updateValueAndValidity();
  assignment.get('type')?.updateValueAndValidity();
  assignment.get('followerGuid')?.updateValueAndValidity();
  assignment.get('followerUniqueKey')?.updateValueAndValidity();
  assignment.get('dueDate')?.updateValueAndValidity();
}
