/**
 * مدل‌ها و منطق خالص صفحه‌ی پاسخ‌دهی (بدون وابستگی به Angular تا قابل آزمون باشد).
 * قواعد اعتبارسنجی و منطق شرطی دقیقاً هم‌سان با سرور (AnswerValidator / SurveyLogicEngine) است.
 */

export const QT = {
  SingleChoice: 1, MultipleChoice: 2, ShortText: 3, LongText: 4, Rating: 5, LinearScale: 6,
  Date: 7, Time: 8, FileUpload: 9, Dropdown: 10, MatrixSingle: 11, MatrixMultiple: 12,
  Ranking: 13, Number: 14, Email: 15, Phone: 16, Address: 17, YesNo: 18, NPS: 19,
} as const;

export const VT = { None: 0, Email: 1, Phone: 2, NationalCode: 3, Number: 4, NumberRange: 5, TextLength: 6, CustomRegex: 7, Url: 8 } as const;
export const LOGIC = { Show: 1, Hide: 2, SkipTo: 3, End: 4 } as const;
export const OP = { Equals: 1, NotEquals: 2, Contains: 3, NotContains: 4, Greater: 5, Less: 6, Answered: 7, NotAnswered: 8 } as const;

export interface PublicOption { guid: string; optionText: string; sortOrder: number; value?: string | null; imageUrl?: string | null; color?: string | null; }
export interface PublicLogic { targetQuestionGuid?: string | null; logicType: number; conditionOperator: number; conditionValue?: string | null; optionGuid?: string | null; priority: number; }
export interface PublicCriterion { guid: string; title: string; description?: string | null; sortOrder: number; }

export interface PublicQuestion {
  guid: string; questionText: string; questionType: number; sortOrder: number; isRequired: boolean;
  helpText?: string | null; placeholder?: string | null; imageUrl?: string | null; videoUrl?: string | null;
  validationType?: number | null; validationErrorMessage?: string | null; customValidationRegex?: string | null;
  minLength?: number | null; maxLength?: number | null; minValue?: number | null; maxValue?: number | null;
  minSelections?: number | null; maxSelections?: number | null;
  options?: PublicOption[] | null; randomizeOptions: boolean; allowOtherOption: boolean; otherOptionText?: string | null;
  minScaleLabel?: string | null; maxScaleLabel?: string | null;
  matrixRows: string[]; matrixColumns: string[];
  maxFileSize?: number | null; allowedFileTypes?: string | null;
  criterionGuid?: string | null; logics: PublicLogic[];
}

export interface PublicSurvey {
  guid: string; title: string; description: string;
  welcomeMessage?: string | null; thankYouMessage?: string | null;
  themeColor?: string | null; completionEffect?: string | null;
  logoGuid?: string | null; backgroundImageGuid?: string | null;
  allowAnonymous: boolean; allowSaveDraft: boolean; showProgressBar: boolean; randomizeQuestions: boolean;
  allowMultipleResponses: boolean; requireLogin: boolean;
  totalQuestions: number; maxResponses?: number | null; totalResponses: number;
  startDate: string; endDate: string; isActive: boolean; isExpired: boolean; isFull: boolean;
  showType: number; criteria: PublicCriterion[]; questions: PublicQuestion[];
}

export interface UserStatus { hasParticipated: boolean; hasDraft: boolean; draftProgressPercentage: number; canRespond: boolean; }

export interface SavedAnswer {
  questionGuid: string; textAnswer?: string | null; numericAnswer?: number | null; dateAnswer?: string | null;
  selectedOptionGuid?: string | null; selectedOptionGuids?: string[] | null; otherAnswer?: string | null;
  fileUrl?: string | null; fileName?: string | null; fileSize?: number | null;
  matrixAnswers?: Record<string, string> | null; rankingAnswers?: number[] | null;
}

export interface UserDraft {
  surveyGuid: string; answeredCount: number; totalQuestions: number; progressPercentage: number;
  startedAt: string; lastSavedAt: string; resumeQuestionGuid?: string | null; savedAnswers: SavedAnswer[];
}

export interface DraftSaved { answeredCount: number; totalQuestions: number; progressPercentage: number; savedAt: string; rejectedQuestionGuids: string[]; }

/** مقدار پاسخ یک سوال در حافظه‌ی صفحه */
export interface AnswerValue {
  text?: string;
  number?: number | null;
  date?: string;                       // yyyy/MM/dd شمسی یا HH:mm
  option?: string | null;              // guid گزینه
  options?: string[];                  // guid گزینه‌ها
  other?: string;
  otherSelected?: boolean;
  file?: { url: string; name: string; size: number } | null;
  matrix?: Record<string, string>;     // ردیف → ستون (چندانتخابی: «الف,ب»)
  ranking?: string[];                  // ترتیب guid گزینه‌ها از اول به آخر
}

export interface ResponseAnswerDto {
  questionGuid: string; questionType: number;
  textAnswer?: string | null; numericAnswer?: number | null; dateAnswer?: string | null;
  selectedOptionGuid?: string | null; selectedOptionGuids?: string[] | null; otherAnswer?: string | null;
  fileUrl?: string | null; fileName?: string | null; fileSize?: number | null;
  matrixAnswers?: Record<string, string> | null; rankingAnswers?: number[] | null;
  timeSpentSeconds?: number | null; isSkipped: boolean;
}

// ───────────────────────────── helpers ─────────────────────────────

export const isChoice = (t: number) => t === QT.SingleChoice || t === QT.Dropdown || t === QT.YesNo;
export const isMatrix = (t: number) => t === QT.MatrixSingle || t === QT.MatrixMultiple;
export const isNumeric = (t: number) => t === QT.Number || t === QT.Rating || t === QT.LinearScale || t === QT.NPS;
export const isText = (t: number) => t === QT.ShortText || t === QT.LongText || t === QT.Email || t === QT.Phone || t === QT.Address;

export function toLatinDigits(s: string): string {
  return (s ?? '').replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0)).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
}

export function sortedOptions(q: PublicQuestion): PublicOption[] {
  return [...(q.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function numericRange(q: PublicQuestion): { min: number; max: number } {
  switch (q.questionType) {
    case QT.Rating: return { min: q.minValue ?? 1, max: q.maxValue ?? 5 };
    case QT.LinearScale: return { min: q.minValue ?? 0, max: q.maxValue ?? 10 };
    case QT.NPS: return { min: 0, max: 10 };
    default: return { min: q.minValue ?? Number.NEGATIVE_INFINITY, max: q.maxValue ?? Number.POSITIVE_INFINITY };
  }
}

/** آیا مقداری وارد شده است (برای نقشه‌ی سوال‌ها و منطق «پاسخ داده شده») */
export function isFilled(q: PublicQuestion, v: AnswerValue | undefined): boolean {
  if (!v) return false;
  const t = q.questionType;
  if (isText(t)) return !!v.text?.trim();
  if (isNumeric(t)) return v.number != null && !Number.isNaN(v.number);
  if (t === QT.Date || t === QT.Time) return !!v.date;
  if (isChoice(t)) return !!v.option || (!!v.otherSelected && !!v.other?.trim());
  if (t === QT.MultipleChoice) return !!v.options?.length || (!!v.otherSelected && !!v.other?.trim());
  if (t === QT.FileUpload) return !!v.file?.url;
  if (isMatrix(t)) return Object.values(v.matrix ?? {}).some(x => !!x);
  if (t === QT.Ranking) return !!v.ranking?.length;
  return false;
}

/** پاسخ کامل (برای سوال اجباری؛ در ماتریس همه‌ی ردیف‌ها) */
export function isComplete(q: PublicQuestion, v: AnswerValue | undefined): boolean {
  if (!isFilled(q, v)) return false;
  if (isMatrix(q.questionType) && q.matrixRows.length) return q.matrixRows.every(r => !!v!.matrix?.[r]);
  return true;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[0-9\-\s()]{7,20}$/;

function isNationalCode(code: string): boolean {
  if (!/^\d{10}$/.test(code) || new Set(code).size === 1) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(code[i]) * (10 - i);
  const r = sum % 11, c = Number(code[9]);
  return r < 2 ? c === r : c === 11 - r;
}

/** اعتبارسنجی یک پاسخ؛ پیام خطا یا null */
export function validateAnswer(q: PublicQuestion, v: AnswerValue | undefined): string | null {
  if (!isFilled(q, v)) return q.isRequired ? 'پاسخ به این سوال الزامی است.' : null;
  const t = q.questionType;
  const custom = q.validationErrorMessage?.trim() || null;

  if (isText(t)) {
    const text = v!.text!.trim();
    const latin = toLatinDigits(text);
    if (text.length > 4000) return 'حداکثر ۴۰۰۰ نویسه مجاز است.';
    if (q.minLength && text.length < q.minLength) return `حداقل ${q.minLength} نویسه وارد کنید.`;
    if (q.maxLength && text.length > q.maxLength) return `حداکثر ${q.maxLength} نویسه مجاز است.`;
    if (t === QT.Email && !EMAIL.test(text)) return custom ?? 'ایمیل معتبر نیست.';
    if (t === QT.Phone && !PHONE.test(latin)) return custom ?? 'شماره تلفن معتبر نیست.';
    switch (q.validationType ?? 0) {
      case VT.Email: if (!EMAIL.test(text)) return custom ?? 'ایمیل معتبر نیست.'; break;
      case VT.Phone: if (!PHONE.test(latin)) return custom ?? 'شماره تلفن معتبر نیست.'; break;
      case VT.NationalCode: if (!isNationalCode(latin)) return custom ?? 'کد ملی معتبر نیست.'; break;
      case VT.Number: if (Number.isNaN(Number(latin))) return custom ?? 'فقط عدد وارد کنید.'; break;
      case VT.NumberRange: {
        const n = Number(latin);
        if (Number.isNaN(n) || (q.minValue != null && n < q.minValue) || (q.maxValue != null && n > q.maxValue))
          return custom ?? 'عدد خارج از بازه‌ی مجاز است.';
        break;
      }
      case VT.Url:
        if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(text)) return custom ?? 'نشانی وب معتبر نیست.';
        break;
      case VT.CustomRegex:
        if (q.customValidationRegex) {
          try { if (!new RegExp(q.customValidationRegex).test(text)) return custom ?? 'قالب پاسخ صحیح نیست.'; }
          catch { /* الگوی نامعتبر طراح: پاسخ‌دهنده مسدود نمی‌شود */ }
        }
        break;
    }
    return null;
  }

  if (isNumeric(t)) {
    const { min, max } = numericRange(q);
    const n = v!.number!;
    if (n < min || n > max) return `مقدار باید بین ${Number.isFinite(min) ? min : '-'} و ${Number.isFinite(max) ? max : '-'} باشد.`;
    return null;
  }

  if (t === QT.MultipleChoice) {
    const count = (v!.options?.length ?? 0) + (v!.otherSelected && v!.other?.trim() ? 1 : 0);
    if (q.minSelections && count < q.minSelections) return `حداقل ${q.minSelections} گزینه انتخاب کنید.`;
    if (q.maxSelections && count > q.maxSelections) return `حداکثر ${q.maxSelections} گزینه می‌توانید انتخاب کنید.`;
    return null;
  }

  if (isMatrix(t) && q.isRequired && !isComplete(q, v)) return 'لطفاً به همه‌ی ردیف‌ها پاسخ دهید.';

  if ((t === QT.SingleChoice || t === QT.Dropdown) && !v!.option && v!.otherSelected && !v!.other?.trim())
    return 'متن گزینه‌ی «سایر» را وارد کنید.';

  return null;
}

/** تبدیل مقدار صفحه به DTO سرور؛ null یعنی «پاسخ خالی» */
export function toDto(q: PublicQuestion, v: AnswerValue | undefined, timeSpentSeconds?: number): ResponseAnswerDto {
  const base: ResponseAnswerDto = { questionGuid: q.guid, questionType: q.questionType, isSkipped: false, timeSpentSeconds: timeSpentSeconds ?? null };
  if (!isFilled(q, v)) return { ...base, isSkipped: true };
  const t = q.questionType;
  if (isText(t)) return { ...base, textAnswer: v!.text!.trim() };
  if (isNumeric(t)) return { ...base, numericAnswer: v!.number! };
  if (t === QT.Date || t === QT.Time) return { ...base, dateAnswer: toLatinDigits(v!.date!) };
  const other = v!.otherSelected ? v!.other?.trim() || null : null;
  if (isChoice(t)) return { ...base, selectedOptionGuid: v!.option || null, otherAnswer: other };
  if (t === QT.MultipleChoice) return { ...base, selectedOptionGuids: v!.options ?? [], otherAnswer: other };
  if (t === QT.FileUpload) return { ...base, fileUrl: v!.file!.url, fileName: v!.file!.name, fileSize: v!.file!.size };
  if (isMatrix(t)) {
    const m: Record<string, string> = {};
    for (const [k, x] of Object.entries(v!.matrix ?? {})) if (x) m[k] = x;
    return { ...base, matrixAnswers: m };
  }
  if (t === QT.Ranking) {
    // سرور: rank هر گزینه به ترتیب SortOrder گزینه‌ها (۱ = اول)
    const order = v!.ranking ?? [];
    return { ...base, rankingAnswers: sortedOptions(q).map(o => { const i = order.indexOf(o.guid); return i < 0 ? order.length + 1 : i + 1; }) };
  }
  return { ...base, isSkipped: true };
}

/** بازسازی مقدار صفحه از پیش‌نویس ذخیره‌شده‌ی سرور یا مرورگر */
export function fromSaved(q: PublicQuestion, s: SavedAnswer): AnswerValue {
  const t = q.questionType;
  if (isText(t)) return { text: s.textAnswer ?? '' };
  if (isNumeric(t)) return { number: s.numericAnswer ?? (s.textAnswer ? Number(toLatinDigits(s.textAnswer)) : null) };
  if (t === QT.Date) return { date: s.dateAnswer ? toLatinDigits(s.dateAnswer).slice(0, 10) : '' };
  if (t === QT.Time) return { date: s.dateAnswer ? (toLatinDigits(s.dateAnswer).match(/\d{1,2}:\d{2}/)?.[0] ?? '') : '' };
  if (isChoice(t)) return { option: s.selectedOptionGuid ?? null, other: s.otherAnswer ?? '', otherSelected: !!s.otherAnswer && !s.selectedOptionGuid };
  if (t === QT.MultipleChoice) return { options: s.selectedOptionGuids ?? [], other: s.otherAnswer ?? '', otherSelected: !!s.otherAnswer };
  if (t === QT.FileUpload) return { file: s.fileUrl ? { url: s.fileUrl, name: s.fileName ?? 'فایل', size: s.fileSize ?? 0 } : null };
  if (isMatrix(t)) return { matrix: { ...(s.matrixAnswers ?? {}) } };
  if (t === QT.Ranking) {
    const ranks = s.rankingAnswers ?? [];
    const opts = sortedOptions(q);
    return { ranking: opts.map((o, i) => ({ g: o.guid, r: ranks[i] ?? 999 })).sort((a, b) => a.r - b.r).map(x => x.g) };
  }
  return {};
}

/** تبدیل DTO به SavedAnswer (برای ذخیره‌ی پیش‌نویس کاربر ناشناس در مرورگر) */
export function dtoToSaved(d: ResponseAnswerDto): SavedAnswer {
  return { ...d } as SavedAnswer;
}

// ───────────────────────────── منطق شرطی ─────────────────────────────

function logicMatches(l: PublicLogic, q: PublicQuestion, v: AnswerValue | undefined): boolean {
  const answered = isFilled(q, v);
  if (l.conditionOperator === OP.Answered) return answered;
  if (l.conditionOperator === OP.NotAnswered) return !answered;
  if (!answered) return false;

  const selected = new Set<string>([...(v!.option ? [v!.option] : []), ...(v!.options ?? [])].map(x => x.toLowerCase()));
  const text = (v!.text ?? (v!.otherSelected ? v!.other : '') ?? '').trim().toLowerCase();
  const raw = (l.conditionValue ?? '').trim();
  const value = raw.toLowerCase();
  const num = v!.number != null ? v!.number : (text && !Number.isNaN(Number(toLatinDigits(text))) ? Number(toLatinDigits(text)) : null);
  const target = Number(toLatinDigits(raw));
  const opt = l.optionGuid?.toLowerCase();

  switch (l.conditionOperator) {
    case OP.Equals: return opt ? selected.has(opt) : num != null && raw && !Number.isNaN(target) ? num === target : text === value;
    case OP.NotEquals: return opt ? !selected.has(opt) : num != null && raw && !Number.isNaN(target) ? num !== target : text !== value;
    case OP.Contains: return opt ? selected.has(opt) : text.includes(value);
    case OP.NotContains: return opt ? !selected.has(opt) : !text.includes(value);
    case OP.Greater: return num != null && !Number.isNaN(target) && num > target;
    case OP.Less: return num != null && !Number.isNaN(target) && num < target;
  }
  return false;
}

/**
 * سوال‌های «مرتبط» با توجه به پاسخ‌ها (هم‌سان با SurveyLogicEngine سرور):
 * پیمایش به ترتیب SortOrder؛ نمایش/پنهان/پرش/پایان.
 */
export function relevantQuestionGuids(questions: PublicQuestion[], answers: ReadonlyMap<string, AnswerValue>): Set<string> {
  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = new Map(ordered.map((q, i) => [q.guid.toLowerCase(), i]));
  const showTargets = new Set(ordered.flatMap(q => q.logics ?? [])
    .filter(l => l.logicType === LOGIC.Show && l.targetQuestionGuid).map(l => l.targetQuestionGuid!.toLowerCase()));
  const shown = new Set<string>(), hidden = new Set<string>(), relevant = new Set<string>();
  let skipUntil = -1, ended = false;

  ordered.forEach((q, i) => {
    const g = q.guid.toLowerCase();
    if (ended || i < skipUntil) return;
    if (hidden.has(g) || (showTargets.has(g) && !shown.has(g))) return;
    relevant.add(q.guid);
    const v = answers.get(q.guid);
    for (const l of [...(q.logics ?? [])].sort((a, b) => a.priority - b.priority)) {
      if (!logicMatches(l, q, v)) continue;
      const target = l.targetQuestionGuid?.toLowerCase();
      if (l.logicType === LOGIC.Show && target) shown.add(target);
      else if (l.logicType === LOGIC.Hide && target) hidden.add(target);
      else if (l.logicType === LOGIC.SkipTo && target && (index.get(target) ?? -1) > i) skipUntil = Math.max(skipUntil, index.get(target)!);
      else if (l.logicType === LOGIC.End) ended = true;
    }
  });
  return relevant;
}

// ───────────────────────────── تاریخ شمسی ─────────────────────────────

export function jalaliDaysInMonth(y: number, m: number): number {
  if (m <= 6) return 31;
  if (m <= 11) return 30;
  // قاعده‌ی ۳۳ساله (منطبق بر تقویم رسمی برای ۱۳۴۳ تا ۱۴۷۲؛ مثلاً ۱۳۹۹ و ۱۴۰۳ کبیسه‌اند)
  return ((y * 8 + 29) % 33 + 33) % 33 < 8 ? 30 : 29;
}

export function todayJalali(): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date());
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day') };
}

export function toPersianDigits(v: string | number | null | undefined): string {
  return String(v ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}
