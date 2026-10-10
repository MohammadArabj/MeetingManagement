// ============================================================
// survey-wizard.model.ts
// ✅ اضافه شدن isRemoved به Question/Option/AccessItem برای Sync حذف نرم
// ✅ اضافه شدن مدل Logic (منطق شرطی سوالات) که قبلاً اصلاً در مدل نبود
// ============================================================

// ==================== Survey Data ====================
export interface WizardSurveyData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  accessType?: string;
  showType?: string;
  allowAnonymous: boolean;
  allowSaveDraft: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  allowMultipleResponses: boolean;
  requireLogin: boolean;
  welcomeMessage: string;
  thankYouMessage: string;
  maxResponses: number | null;
  themeColor: string;
  logoGuid?: string;
  hasCriteria?: boolean;
  backgroundImageGuid?: string;
  /** جلوه‌ی صفحه‌ی تشکر — null/undefined یعنی confetti */
  completionEffect?: CompletionEffectType | null;
}

// ==================== Completion Effect ====================
export type CompletionEffectType =
  | 'confetti' | 'fireworks' | 'balloons' | 'stars' | 'hearts' | 'ribbons' | 'none';

export const COMPLETION_EFFECTS: { value: CompletionEffectType; title: string; icon: string }[] = [
  { value: 'confetti', title: 'کاغذ رنگی', icon: 'fa-star-of-life' },
  { value: 'fireworks', title: 'آتش‌بازی', icon: 'fa-burst' },
  { value: 'balloons', title: 'بادکنک', icon: 'fa-circle' },
  { value: 'stars', title: 'ستاره‌های چشمک‌زن', icon: 'fa-star' },
  { value: 'hearts', title: 'قلب‌های شناور', icon: 'fa-heart' },
  { value: 'ribbons', title: 'روبان و نوار', icon: 'fa-ribbon' },
  { value: 'none', title: 'بدون جلوه', icon: 'fa-ban' },
];

export function normalizeCompletionEffect(v: unknown): CompletionEffectType {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return (COMPLETION_EFFECTS.some(e => e.value === s) ? s : 'confetti') as CompletionEffectType;
}

// ==================== Question Types ====================
/** مطابق enum QuestionType در بک‌اند (Date = 7, Time = 8) */
export const QUESTION_TYPE_LABELS: Record<number, string> = {
  1: 'چند گزینه‌ای (تک انتخابی)',
  2: 'چند گزینه‌ای (چند انتخابی)',
  3: 'متن کوتاه',
  4: 'متن بلند',
  5: 'امتیازدهی',
  7: 'تاریخ',
  8: 'زمان/تاریخ (قدیمی)',
  9: 'آپلود فایل',
  10: 'لیست کشویی',
  11: 'ماتریس',
};

/** مطابق enum ValidationType در بک‌اند */
export const VALIDATION_TYPE_LABELS: Record<number, string> = {
  0: 'بدون اعتبارسنجی',
  1: 'ایمیل',
  2: 'شماره تلفن',
  3: 'کد ملی',
  4: 'عدد',
  5: 'بازه‌ی عددی',
  6: 'طول متن',
  7: 'الگوی سفارشی (عبارت باقاعده)',
  8: 'نشانی وب',
};

// ==================== Matrix helpers ====================
/**
 * تبدیل ورودی متنی/آرایه/JSON به لیست تمیز:
 * جداسازی با کاما، کامای فارسی «،» و خط جدید؛ trim؛ حذف موارد خالی.
 */
export function parseList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map(v => String(v ?? '').trim()).filter(v => !!v);
  }
  const str = String(value).trim();
  if (!str) return [];
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parseList(parsed);
    } catch { /* ادامه با جداسازی ساده */ }
  }
  return str.split(/[,،\n\r]+/).map(v => v.trim()).filter(v => !!v);
}

/**
 * نرمال‌سازی سوال دریافتی از GetDetailWithQuestions به مدل ویزارد
 * (نام‌های متفاوت بک‌اند: MatrixRowsJson, ValidationRegex, MinSelection, ...)
 */
export function normalizeQuestionFromServer(raw: any): WizardQuestionData {
  const q = { ...(raw ?? {}) } as any;
  q.matrixRows = parseList(q.matrixRows ?? q.matrixRowsJson);
  q.matrixColumns = parseList(q.matrixColumns ?? q.matrixColumnsJson);
  delete q.matrixRowsJson;
  delete q.matrixColumnsJson;
  q.customValidationRegex = q.customValidationRegex ?? q.validationRegex ?? undefined;
  q.minSelections = q.minSelections ?? q.minSelection ?? null;
  q.maxSelections = q.maxSelections ?? q.maxSelection ?? null;
  q.tempId = q.tempId || q.guid || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  // سرور منطق‌ها را با نام logicRules برمی‌گرداند؛ بدون این نگاشت، ذخیره‌ی ویرایش منطق‌ها را از دست می‌داد
  if (!q.logics && Array.isArray(q.logicRules)) {
    q.logics = q.logicRules.map((l: any) => ({
      guid: l.guid,
      targetQuestionGuid: l.targetQuestionGuid && l.targetQuestionGuid !== '00000000-0000-0000-0000-000000000000' ? l.targetQuestionGuid : undefined,
      logicType: Number(l.logicType),
      conditionOperator: Number(l.conditionOperator),
      conditionValue: l.conditionValue ?? undefined,
      optionGuid: l.selectedOptionGuid ?? l.optionGuid ?? undefined,
      priority: l.priority ?? 0,
    }));
  }
  delete q.logicRules;
  q.options = (q.options ?? []).map((o: any) => ({
    ...o,
    tempId: o.tempId || o.guid || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    color: o.color || undefined,
  }));
  return q as WizardQuestionData;
}

// ==================== Question Data ====================
export interface WizardQuestionData {
  tempId: string;
  /** Guid واقعی سوال — فقط برای سوالات از قبل موجود (در حالت ویرایش) پر می‌شود */
  guid?: string;
  /** ✅ جدید — اگر true باشد، این سوال هنگام ثبت باید حذف شود (به همراه پاسخ‌های ثبت‌شده برایش) */
  isRemoved?: boolean;

  questionText: string;
  questionType: number;
  sortOrder: number;
  isRequired: boolean;
  helpText?: string;
  placeholder?: string;
  imageGuid?: string;
  videoGuid?: string;
  criterionGuid?: string;
  // Validation
  validationType?: number;
  validationErrorMessage?: string;
  customValidationRegex?: string;
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;

  // Selection limits
  minSelections?: number | null;
  maxSelections?: number | null;

  // Scale
  minScaleLabel?: string;
  maxScaleLabel?: string;

  // Matrix — مطابق List<string> در بک‌اند
  matrixRows?: string[];
  matrixColumns?: string[];

  // File upload
  maxFileSize?: number | null;
  allowedFileTypes?: string;

  // Options
  randomizeOptions?: boolean;
  allowOtherOption?: boolean;
  otherOptionText?: string;
  options?: WizardOptionData[];

  // ✅ جدید — منطق شرطی (Skip Logic / Branching) این سوال
  logics?: WizardLogicData[];
}
export interface WizardCriterionData {
  guid: string;            // همیشه پر است — با crypto.randomUUID() ساخته می‌شود
  title: string;
  description?: string;
  sortOrder: number;
  isRemoved?: boolean;
}

export function createEmptyCriterion(sortOrder: number): WizardCriterionData {
  return {
    guid: crypto.randomUUID(),
    title: '',
    sortOrder,
  };
}
export interface WizardOptionData {
  tempId: string;
  /** Guid واقعی گزینه — فقط برای گزینه‌های از قبل موجود پر می‌شود */
  guid?: string;
  /** ✅ جدید — اگر true باشد، این گزینه هنگام ثبت باید حذف شود */
  isRemoved?: boolean;

  optionText: string;
  sortOrder: number;
  value?: number | null;
  color?: string;
  imageGuid?: string;
}

// ==================== ✅ Question Logic (NEW) ====================

/**
 * منطق شرطی سوال (Skip Logic / Branching)
 * معادل LogicForWizardDto در بک‌اند
 */
export interface WizardLogicData {
  tempId?: string;
  /** Guid واقعی منطق — فقط برای موارد از قبل موجود پر می‌شود */
  guid?: string;
  /** ✅ اگر true باشد، این منطق هنگام ثبت باید حذف شود */
  isRemoved?: boolean;

  /** Guid سوال مقصد (سوالی که باید نمایش/مخفی شود) */
  targetQuestionGuid?: string;
  logicType: number;
  conditionOperator: number;
  conditionValue?: string;
  /** Guid گزینه‌ای که شرط روی آن اعمال می‌شود (در صورت وجود) */
  optionGuid?: string;
  priority: number;
}

// ==================== Uploaded Files ====================
export interface WizardUploadedFiles {
  logo: string | null;
  backgroundImage: string | null;
  questionImages: Map<string, string>;
  questionVideos: Map<string, string>;
  optionImages: Map<string, string>;
}

export function createEmptyUploadedFiles(): WizardUploadedFiles {
  return {
    logo: null,
    backgroundImage: null,
    questionImages: new Map(),
    questionVideos: new Map(),
    optionImages: new Map(),
  };
}

// ==================== ✅ Access Control ====================

export enum WizardTargetType {
  User = 1,
  Unit = 2,
}

export interface WizardAccessItem {
  tempId: string;
  /** Guid واقعی رکورد دسترسی — فقط برای موارد از قبل موجود (حالت ویرایش) پر می‌شود */
  guid?: string;
  /** ✅ جدید — اگر true باشد، این دسترسی هنگام ثبت باید حذف شود */
  isRemoved?: boolean;

  targetType: WizardTargetType;
  targetGuid: string;
  targetName: string;
  targetPosition?: string;
  targetUnit?: string;
  addedViaUnit?: boolean;
  sourceUnitGuid?: string;
  sourceUnitName?: string;

  // Permissions
  canView: boolean;
  canRespond: boolean;
  canViewResults: boolean;
  canEdit: boolean;
  canDelete: boolean;

  expirationDate?: string;
}

export function createDefaultAccessItem(
  user: { guid: string; name: string; position?: string; unit?: string },
  source?: { unitGuid: string; unitName: string }
): WizardAccessItem {
  return {
    tempId: `access_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    guid: undefined,
    isRemoved: false,
    targetType: WizardTargetType.User,
    targetGuid: user.guid,
    targetName: user.name,
    targetPosition: user.position,
    targetUnit: user.unit,
    addedViaUnit: !!source,
    sourceUnitGuid: source?.unitGuid,
    sourceUnitName: source?.unitName,

    canView: true,
    canRespond: true,
    canViewResults: false,
    canEdit: false,
    canDelete: false,
  };
}

// ==================== Excel Import ====================

export interface ExcelQuestionRow {
  questionText: string;
  questionType: string;
  isRequired: string;
  options?: string;
  helpText?: string;
  placeholder?: string;
  minScaleLabel?: string;
  maxScaleLabel?: string;
}

export const QUESTION_TYPE_MAP: Record<string, number> = {
  'چند گزینه‌ای (تک انتخابی)': 1,
  'تک انتخابی': 1,
  'چند گزینه‌ای (چند انتخابی)': 2,
  'چند انتخابی': 2,
  'متن کوتاه': 3,
  'متن بلند': 4,
  'امتیازدهی': 5,
  'تاریخ': 7,
  'آپلود فایل': 9,
  'لیست کشویی': 10,
  'ماتریس': 11,
};

// ==================== DTOs (خروجی نهایی برای ارسال به بک‌اند) ====================

export interface CreateSurveyWithQuestionsDto {
  survey: {
    guid?: string;
    logoGuid?: string | null;
    backgroundImageGuid?: string | null;
  } & Omit<WizardSurveyData, 'logoGuid' | 'backgroundImageGuid'>;

  questions: (WizardQuestionData & {
    sortOrder: number;
    imageGuid?: string;
    videoGuid?: string;
    options?: (WizardOptionData & { imageGuid?: string })[];
    logics?: WizardLogicData[];
  })[];
  criteria?: {
    guid: string;
    title: string;
    description?: string;
    sortOrder: number;
    isRemoved: boolean;
  }[];
  accessItems?: {
    guid?: string;
    isRemoved?: boolean;
    targetType: number;
    targetGuid: string;
    canView: boolean;
    canRespond: boolean;
    canViewResults: boolean;
    canEdit: boolean;
    canDelete: boolean;
    expirationDate?: string;
  }[];
}