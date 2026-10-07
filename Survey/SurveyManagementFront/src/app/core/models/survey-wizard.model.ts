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

  // Matrix
  matrixRows?: string;
  matrixColumns?: string;

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
  'تاریخ': 8,
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
  } & WizardSurveyData;

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