import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ConflictResult } from '../../../core/types/conflict-result';
import { AgendaFileDto } from './meeting-agendas/meeting-agendas';
import { formatTime } from './meeting-ops.helpers';

// ═══════════════════════════════════════════════════════════
// ساخت، اعتبارسنجی و patch فرم ثبت جلسه
// ═══════════════════════════════════════════════════════════

// ===== FORM VALIDATION =====
export function timeFormatValidator() {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timePattern.test(control.value) ? null : { invalidTimeFormat: true };
  };
}

export function timeRangeValidator(group: AbstractControl): ValidationErrors | null {
  const startTime = group.get('startTime')?.value;
  const endTime = group.get('endTime')?.value;

  if (!startTime || !endTime) return null;

  return startTime >= endTime ? { timeInvalid: true } : null;
}

// ===== FORM BUILDING =====
export function buildMeetingForm(fb: FormBuilder): FormGroup {
  return fb.group({
    guid: [''],
    title: ['', Validators.required],
    categoryGuid: [undefined],
    roomGuid: [undefined, Validators.required],
    roomName: [''],
    roomLink: [''],
    number: [''],
    locationType: ['internal'],
    date: ['', Validators.required],
    startTime: ['', timeFormatValidator()],
    endTime: ['', timeFormatValidator()],
    followGuid: [''],
    notAllowReplacement: [false],
    agendas: fb.array([])
  }, { validators: timeRangeValidator });
}

// ✅ متد مجزا - نکته کلیدی: روی هر سه کنترل updateValueAndValidity صدا زده میشه
export function applyLocationTypeValidators(form: FormGroup, type: string): void {
  const roomNameCtrl = form.get('roomName');
  const roomGuidCtrl = form.get('roomGuid');
  const roomLinkCtrl = form.get('roomLink');

  if (type === 'external') {
    roomGuidCtrl?.clearValidators();
    roomLinkCtrl?.clearValidators();
    roomNameCtrl?.setValidators([Validators.required]);
  } else if (type === 'internal') {
    roomNameCtrl?.clearValidators();
    roomLinkCtrl?.clearValidators();
    roomGuidCtrl?.setValidators([Validators.required]);
  } else {
    // online
    roomNameCtrl?.clearValidators();
    roomGuidCtrl?.clearValidators();
    roomLinkCtrl?.setValidators([Validators.required]);
  }

  // ✅ باگ قبلی اینجا بود: فقط روی roomNameCtrl صدا زده می‌شد.
  // setValidators/clearValidators تا وقتی updateValueAndValidity روی
  // خودِ همون کنترل صدا زده نشه، هیچ اثری روی وضعیت VALID/INVALID نداره.
  roomNameCtrl?.updateValueAndValidity({ emitEvent: false });
  roomGuidCtrl?.updateValueAndValidity({ emitEvent: false });
  roomLinkCtrl?.updateValueAndValidity({ emitEvent: false });
}

// ✅ شماره جلسه فقط برای هیئت‌مدیره required باشد
export function applyBoardNumberValidator(form: FormGroup, isBoard: boolean): void {
  const numberCtrl = form.get('number');
  if (!numberCtrl) return;

  if (isBoard) {
    numberCtrl.setValidators([Validators.required]);
  } else {
    numberCtrl.clearValidators();
    numberCtrl.setValue('', { emitEvent: false });
  }
  numberCtrl.updateValueAndValidity({ emitEvent: false });
}

// ===== خطاهای سفارشی کنترل‌ها =====

/** فقط یک کلید خطا را حذف می‌کند و بقیه خطاها (مثل required) دست نمی‌خورند */
export function removeControlError(ctrl: AbstractControl | null | undefined, key: string): void {
  if (ctrl?.hasError(key)) {
    const errors = { ...ctrl.errors };
    delete errors[key];
    ctrl.setErrors(Object.keys(errors).length ? errors : null);
  }
}

/** تنظیم خطای تکراری بودن شماره جلسه */
export function applyNumberDuplicateError(numberControl: AbstractControl | null | undefined, isDuplicate: boolean): void {
  if (isDuplicate) {
    numberControl?.setErrors({ duplicate: true });
  } else {
    // فقط خطای duplicate را پاک کن
    removeControlError(numberControl, 'duplicate');
  }
}

/** اعمال نتیجه بررسی تداخل روی کنترل مکان */
export function applyRoomConflictError(roomGuidCtrl: AbstractControl | null | undefined, result: ConflictResult): void {
  // ✅ فقط خطای conflict رو حذف کن، بقیه خطاها (مثل required) دست نخوره
  removeControlError(roomGuidCtrl, 'conflict');

  if (result.roomConflict) {
    // ✅ خطای conflict رو به بقیه خطاهای موجود اضافه کن، جایگزین نکن
    const currentErrors = roomGuidCtrl?.errors || {};
    roomGuidCtrl?.setErrors({ ...currentErrors, conflict: true });
  } else {
    // ✅ اگر تداخلی نبود، بذار validatorهای عادی (مثل required) دوباره خودشون رو چک کنن
    roomGuidCtrl?.updateValueAndValidity({ emitEvent: false });
  }
}

// ===== FORM PATCHING METHODS =====
export function patchMeetingForm(form: FormGroup, meeting: any): void {
  form.patchValue({
    guid: meeting.guid,
    title: meeting.title,
    categoryGuid: meeting.categoryGuid,
    roomGuid: meeting.roomGuid,
    roomName: meeting.roomName,
    roomLink: meeting.roomLink,
    locationType: meeting.roomGuid ? 'internal' : meeting.roomLink ? 'online' : 'external',
    followGuid: meeting.followGuid,
    date: meeting.date,
    number: meeting.number,
    notAllowReplacement: meeting.notAllowReplacement,
    startTime: formatTime(meeting.startTime),
    endTime: formatTime(meeting.endTime)
  });
}

export function patchCloneForm(form: FormGroup, meeting: any): void {
  form.patchValue({
    title: '', // خالی برای clone
    categoryGuid: meeting.categoryGuid,
    roomGuid: '', // خالی برای clone - کاربر باید مجدداً انتخاب کند
    roomName: '', // خالی
    roomLink: '', // خالی
    locationType: 'internal', // مقدار پیش‌فرض
    followGuid: '', // خالی برای clone
    date: '', // خالی - کاربر باید وارد کند
    startTime: '', // خالی
    endTime: '', // خالی
    number: '', // خالی برای جلسات هیئت مدیره
    notAllowReplacement: false // پیش‌فرض
  });
}

// ===== دستور جلسات =====

/** ساخت FormGroup دستور جلسه از داده بک‌اند */
export function createAgendaGroup(fb: FormBuilder, agenda: any): FormGroup {
  // تبدیل files از backend به فرمت جدید
  const files: AgendaFileDto[] = (agenda.files || []).map((f: any) => ({
    id: f.id || 0,
    isRemoved: f.isRemoved || false,
    fileGuid: f.fileGuid || f.guid || ''
  }));

  return fb.group({
    id: [agenda.id],
    text: [agenda.text, Validators.required],
    files: [files],
    isRemoved: [false]
  });
}

/** ساخت FormGroup دستور جلسه از قالب */
export function createTemplateAgendaGroup(fb: FormBuilder, agenda: any): FormGroup {
  return fb.group({
    id: [agenda.id ?? 0],
    description: [agenda.description, Validators.required],
    fileUrl: [agenda.fileUrl]
  });
}

/** جایگزینی کنترل‌های یک FormArray با کنترل‌های FormArray دیگر */
export function replaceFormArrayControls(target: FormArray, source: FormArray): void {
  while (target.length) {
    target.removeAt(0);
  }
  source.controls.forEach(control => {
    target.push(control);
  });
}

/**
 * بررسی متن دستور جلسات فعال؛ در صورت خالی بودن، کنترل را touched می‌کند.
 * @returns true اگر دستور جلسه نامعتبری وجود داشته باشد
 */
export function markInvalidAgendas(form: FormGroup): boolean {
  const agendasFormArray = form.get('agendas') as FormArray;
  const allControls = agendasFormArray?.controls ?? [];

  const activeAgendas = allControls.filter(
    agenda => !agenda.get('isRemoved')?.value
  );

  const hasInvalidAgenda = activeAgendas.some(
    agenda => !agenda.get('text')?.value?.trim()
  );

  if (hasInvalidAgenda) {
    activeAgendas.forEach(agenda => {
      if (!agenda.get('text')?.value?.trim()) {
        agenda.get('text')?.markAsTouched();
      }
    });
  }

  return hasInvalidAgenda;
}

// ===== CONFLICT / SUBMIT VALIDATION =====

/** آیا مقادیر تاریخ و ساعت فرم برای بررسی تداخل کافی و معتبر هستند؟ */
export function isScheduleReadyForConflictCheck(form: FormGroup): boolean {
  const { date, startTime, endTime } = form.value;

  // ✅ چک وجود مقدار
  if (!date || !startTime || !endTime) return false;

  // ✅ چک validity کنترل‌ها
  const startCtrl = form.get('startTime');
  const endCtrl = form.get('endTime');

  if (startCtrl?.invalid || endCtrl?.invalid) return false;

  // ✅ چک خطای timeInvalid روی group
  if (form.hasError('timeInvalid')) return false;

  return true;
}

export interface SubmitValidationState {
  isBoardMeeting: boolean;
  isNumberDuplicate: boolean;
  hasConflicts: boolean;
  hasSecretary: boolean;
  hasChairman: boolean;
}

/**
 * اعتبارسنجی پیش از ثبت جلسه (به همان ترتیب قبلی).
 * در صورت نامعتبر بودن فرم، کنترل‌ها touched می‌شوند.
 * @returns valid و پیام خطای قابل نمایش (در صورت وجود)
 */
export function validateMeetingForSubmit(form: FormGroup, state: SubmitValidationState): { valid: boolean; message?: string } {
  if (state.isBoardMeeting && state.isNumberDuplicate) {
    return { valid: false, message: 'شماره جلسه تکراری است. لطفاً شماره دیگری وارد کنید.' };
  }

  if (state.hasConflicts) {
    return { valid: false, message: 'ثبت جلسه به دلیل وجود تداخل امکان پذیر نیست.' };
  }

  if (form.invalid) {
    form.markAllAsTouched(); // ✅ این roomName رو هم touched میکنه

    // پیام خاص برای آدرس
    const locationType = form.get('locationType')?.value;
    if (locationType === 'external' && form.get('roomName')?.invalid) {
      return { valid: false, message: 'لطفاً آدرس مکان برگزاری را وارد کنید.' };
    }
    return { valid: false };
  }

  if (markInvalidAgendas(form)) {
    return { valid: false, message: 'لطفاً متن همه دستور جلسات را وارد کنید.' };
  }

  // Validate required roles
  if (!state.hasSecretary) {
    return { valid: false, message: "لطفا دبیر جلسه را مشخص کنید." };
  }

  if (!state.hasChairman) {
    return { valid: false, message: "لطفا رئیس جلسه را مشخص کنید." };
  }

  return { valid: true };
}
