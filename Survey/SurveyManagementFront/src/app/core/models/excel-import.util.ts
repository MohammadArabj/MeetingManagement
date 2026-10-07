// ============================================================
// excel-import.util.ts
// ✅ یوتیلیتی برای ایمپورت سوالات از اکسل
// نیاز به نصب: npm install xlsx
// ============================================================

import * as XLSX from 'xlsx';
import {
  WizardQuestionData,
  WizardOptionData,
  QUESTION_TYPE_MAP,
} from '../../core/models/survey-wizard.model';

/**
 * ستون‌های مورد انتظار در فایل اکسل
 */
const EXPECTED_COLUMNS = {
  questionText: 'متن سوال',
  questionType: 'نوع سوال',
  isRequired: 'الزامی',
  options: 'گزینه‌ها',
  helpText: 'متن راهنما',
  placeholder: 'Placeholder',
  minScaleLabel: 'برچسب حداقل',
  maxScaleLabel: 'برچسب حداکثر',
};

/**
 * نتیجه ایمپورت
 */
export interface ExcelImportResult {
  success: boolean;
  questions: WizardQuestionData[];
  errors: string[];
  warnings: string[];
}

/**
 * پارس کردن فایل اکسل و تبدیل به لیست سوالات
 */
export async function parseExcelFile(file: File): Promise<ExcelImportResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: WizardQuestionData[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, questions: [], errors: ['فایل اکسل خالی است'], warnings: [] };
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return { success: false, questions: [], errors: ['هیچ ردیفی در فایل یافت نشد'], warnings: [] };
    }

    // بررسی ستون‌های اجباری
    const firstRow = rows[0];
    const columns = Object.keys(firstRow);

    if (!columns.includes(EXPECTED_COLUMNS.questionText)) {
      errors.push(`ستون "${EXPECTED_COLUMNS.questionText}" یافت نشد. لطفاً از فایل نمونه استفاده کنید.`);
      return { success: false, questions: [], errors, warnings };
    }

    if (!columns.includes(EXPECTED_COLUMNS.questionType)) {
      errors.push(`ستون "${EXPECTED_COLUMNS.questionType}" یافت نشد.`);
      return { success: false, questions: [], errors, warnings };
    }

    // پردازش هر ردیف
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 چون header ردیف 1 است

      const questionText = String(row[EXPECTED_COLUMNS.questionText] || '').trim();
      const questionTypeStr = String(row[EXPECTED_COLUMNS.questionType] || '').trim();
      const isRequiredStr = String(row[EXPECTED_COLUMNS.isRequired] || '').trim();
      const optionsStr = String(row[EXPECTED_COLUMNS.options] || '').trim();
      const helpText = String(row[EXPECTED_COLUMNS.helpText] || '').trim();
      const placeholder = String(row[EXPECTED_COLUMNS.placeholder] || '').trim();
      const minScaleLabel = String(row[EXPECTED_COLUMNS.minScaleLabel] || '').trim();
      const maxScaleLabel = String(row[EXPECTED_COLUMNS.maxScaleLabel] || '').trim();

      // اعتبارسنجی متن سوال
      if (!questionText) {
        warnings.push(`ردیف ${rowNumber}: متن سوال خالی است - رد شد`);
        continue;
      }

      // تبدیل نوع سوال
      const questionType = resolveQuestionType(questionTypeStr);
      if (questionType === null) {
        errors.push(`ردیف ${rowNumber}: نوع سوال "${questionTypeStr}" شناخته نشد`);
        continue;
      }

      // تبدیل الزامی
      const isRequired = ['بله', 'yes', 'true', '1', 'الزامی'].includes(
        isRequiredStr.toLowerCase()
      );

      // تبدیل گزینه‌ها
      let options: WizardOptionData[] | undefined;
      if ([1, 2, 10].includes(questionType) && optionsStr) {
        const optionTexts = optionsStr
          .split(/[,،]/)
          .map((o) => o.trim())
          .filter((o) => o.length > 0);

        if (optionTexts.length < 2) {
          warnings.push(
            `ردیف ${rowNumber}: سوال چندگزینه‌ای حداقل 2 گزینه نیاز دارد (${optionTexts.length} گزینه یافت شد)`
          );
        }

        options = optionTexts.map((text, idx) => ({
          tempId: generateTempId(),
          optionText: text,
          sortOrder: idx + 1,
          color: '#667eea',
        }));
      } else if ([1, 2, 10].includes(questionType) && !optionsStr) {
        warnings.push(`ردیف ${rowNumber}: سوال چندگزینه‌ای بدون گزینه - گزینه‌ها را دستی اضافه کنید`);
        options = [
          { tempId: generateTempId(), optionText: 'گزینه 1', sortOrder: 1, color: '#667eea' },
          { tempId: generateTempId(), optionText: 'گزینه 2', sortOrder: 2, color: '#667eea' },
        ];
      }

      const question: WizardQuestionData = {
        tempId: generateTempId(),
        questionText,
        questionType,
        sortOrder: questions.length + 1,
        isRequired,
        helpText: helpText || undefined,
        placeholder: placeholder || undefined,
        minScaleLabel: minScaleLabel || undefined,
        maxScaleLabel: maxScaleLabel || undefined,
        options,
      };

      questions.push(question);
    }

    if (questions.length === 0) {
      errors.push('هیچ سوال معتبری در فایل یافت نشد');
      return { success: false, questions: [], errors, warnings };
    }

    return {
      success: true,
      questions,
      errors,
      warnings,
    };
  } catch (err) {
    return {
      success: false,
      questions: [],
      errors: [`خطا در خواندن فایل: ${(err as Error).message}`],
      warnings: [],
    };
  }
}

/**
 * تبدیل نام نوع سوال به کد عددی
 */
function resolveQuestionType(typeStr: string): number | null {
  // بررسی مستقیم در مپ
  if (QUESTION_TYPE_MAP[typeStr] !== undefined) {
    return QUESTION_TYPE_MAP[typeStr];
  }

  // بررسی عددی
  const num = Number(typeStr);
  if (!isNaN(num) && [1, 2, 3, 4, 5, 8, 9, 10, 11].includes(num)) {
    return num;
  }

  // بررسی partial match
  const lower = typeStr.toLowerCase();
  for (const [key, value] of Object.entries(QUESTION_TYPE_MAP)) {
    if (key.includes(lower) || lower.includes(key)) {
      return value;
    }
  }

  return null;
}

/**
 * ساخت فایل نمونه اکسل برای دانلود
 */
export function generateExcelTemplate(): Blob {
  const headers = [
    EXPECTED_COLUMNS.questionText,
    EXPECTED_COLUMNS.questionType,
    EXPECTED_COLUMNS.isRequired,
    EXPECTED_COLUMNS.options,
    EXPECTED_COLUMNS.helpText,
    EXPECTED_COLUMNS.placeholder,
    EXPECTED_COLUMNS.minScaleLabel,
    EXPECTED_COLUMNS.maxScaleLabel,
  ];

  // نمونه داده
  const sampleData = [
    {
      [EXPECTED_COLUMNS.questionText]: 'نام و نام خانوادگی شما چیست؟',
      [EXPECTED_COLUMNS.questionType]: 'متن کوتاه',
      [EXPECTED_COLUMNS.isRequired]: 'بله',
      [EXPECTED_COLUMNS.options]: '',
      [EXPECTED_COLUMNS.helpText]: 'لطفاً نام کامل خود را وارد کنید',
      [EXPECTED_COLUMNS.placeholder]: 'نام و نام خانوادگی',
      [EXPECTED_COLUMNS.minScaleLabel]: '',
      [EXPECTED_COLUMNS.maxScaleLabel]: '',
    },
    {
      [EXPECTED_COLUMNS.questionText]: 'جنسیت شما؟',
      [EXPECTED_COLUMNS.questionType]: 'تک انتخابی',
      [EXPECTED_COLUMNS.isRequired]: 'بله',
      [EXPECTED_COLUMNS.options]: 'مرد،زن،ترجیح نمی‌دهم بگویم',
      [EXPECTED_COLUMNS.helpText]: '',
      [EXPECTED_COLUMNS.placeholder]: '',
      [EXPECTED_COLUMNS.minScaleLabel]: '',
      [EXPECTED_COLUMNS.maxScaleLabel]: '',
    },
    {
      [EXPECTED_COLUMNS.questionText]: 'میزان رضایت شما از خدمات؟',
      [EXPECTED_COLUMNS.questionType]: 'امتیازدهی',
      [EXPECTED_COLUMNS.isRequired]: 'بله',
      [EXPECTED_COLUMNS.options]: '',
      [EXPECTED_COLUMNS.helpText]: 'از 1 تا 5 امتیاز دهید',
      [EXPECTED_COLUMNS.placeholder]: '',
      [EXPECTED_COLUMNS.minScaleLabel]: 'بسیار ضعیف',
      [EXPECTED_COLUMNS.maxScaleLabel]: 'عالی',
    },
    {
      [EXPECTED_COLUMNS.questionText]: 'کدام خدمات را استفاده کرده‌اید؟',
      [EXPECTED_COLUMNS.questionType]: 'چند انتخابی',
      [EXPECTED_COLUMNS.isRequired]: 'خیر',
      [EXPECTED_COLUMNS.options]: 'پشتیبانی،آموزش،مشاوره،فروش',
      [EXPECTED_COLUMNS.helpText]: 'می‌توانید چند گزینه انتخاب کنید',
      [EXPECTED_COLUMNS.placeholder]: '',
      [EXPECTED_COLUMNS.minScaleLabel]: '',
      [EXPECTED_COLUMNS.maxScaleLabel]: '',
    },
    {
      [EXPECTED_COLUMNS.questionText]: 'توضیحات تکمیلی',
      [EXPECTED_COLUMNS.questionType]: 'متن بلند',
      [EXPECTED_COLUMNS.isRequired]: 'خیر',
      [EXPECTED_COLUMNS.options]: '',
      [EXPECTED_COLUMNS.helpText]: '',
      [EXPECTED_COLUMNS.placeholder]: 'نظرات و پیشنهادات خود را بنویسید...',
      [EXPECTED_COLUMNS.minScaleLabel]: '',
      [EXPECTED_COLUMNS.maxScaleLabel]: '',
    },
  ];

  // ساخت Sheet راهنما
  const guideData = [
    { 'نوع سوال': 'متن کوتاه', 'کد عددی': 3, 'توضیحات': 'پاسخ تک‌خطی' },
    { 'نوع سوال': 'متن بلند', 'کد عددی': 4, 'توضیحات': 'پاسخ چند خطی' },
    { 'نوع سوال': 'تک انتخابی', 'کد عددی': 1, 'توضیحات': 'چند گزینه‌ای - فقط یک گزینه' },
    { 'نوع سوال': 'چند انتخابی', 'کد عددی': 2, 'توضیحات': 'چند گزینه‌ای - چند گزینه' },
    { 'نوع سوال': 'لیست کشویی', 'کد عددی': 10, 'توضیحات': 'انتخاب از لیست' },
    { 'نوع سوال': 'امتیازدهی', 'کد عددی': 5, 'توضیحات': 'مقیاس 1 تا 5' },
    { 'نوع سوال': 'تاریخ', 'کد عددی': 8, 'توضیحات': 'انتخاب تاریخ' },
    { 'نوع سوال': 'آپلود فایل', 'کد عددی': 9, 'توضیحات': 'بارگذاری فایل' },
    { 'نوع سوال': 'ماتریس', 'کد عددی': 11, 'توضیحات': 'جدول ماتریسی' },
  ];

  const workbook = XLSX.utils.book_new();

  // Sheet 1: سوالات
  const ws1 = XLSX.utils.json_to_sheet(sampleData);

  // تنظیم عرض ستون‌ها
  ws1['!cols'] = [
    { wch: 40 }, // متن سوال
    { wch: 25 }, // نوع سوال
    { wch: 10 }, // الزامی
    { wch: 40 }, // گزینه‌ها
    { wch: 30 }, // متن راهنما
    { wch: 25 }, // placeholder
    { wch: 15 }, // برچسب حداقل
    { wch: 15 }, // برچسب حداکثر
  ];

  XLSX.utils.book_append_sheet(workbook, ws1, 'سوالات');

  // Sheet 2: راهنما
  const ws2 = XLSX.utils.json_to_sheet(guideData);
  ws2['!cols'] = [
    { wch: 25 },
    { wch: 12 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(workbook, ws2, 'راهنمای انواع سوال');

  // تبدیل به Blob
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
