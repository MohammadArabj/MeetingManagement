// ============================================================
// analytics-excel-export.util.ts
// ✅ یوتیلیتی خروجی Excel از تحلیل سوال‌به‌سوال نظرسنجی
// نیاز به: npm install exceljs
// ============================================================

import ExcelJS from 'exceljs';
import {
    SurveyAnalyticsDto,
    QuestionAnalyticsDto,
    DemographicBucketDto,
} from '../../core/models/survey-analytics.model';

const FONT_NAME = 'BNazanin';
const HEADER_FILL = 'FFEFEFEF';

/**
 * ساخت Workbook کامل تحلیل نظرسنجی (چند شیت) و برگرداندن آن به‌صورت Blob
 */
export async function generateAnalyticsExcelBlob(analytics: SurveyAnalyticsDto): Promise<Blob> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'سامانه نظرسنجی';
    workbook.created = new Date();

    appendOverviewSheet(workbook, analytics);
    appendQuestionsSummarySheet(workbook, analytics);
    appendChoiceStatsSheet(workbook, analytics);
    appendNumericStatsSheet(workbook, analytics);
    appendTextSentimentSheet(workbook, analytics);
    appendTopWordsSheet(workbook, analytics);
    appendTextSamplesSheet(workbook, analytics);
    appendRankingSheet(workbook, analytics);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}

/**
 * ساخت و دانلود مستقیم فایل اکسل تحلیل
 */
export async function downloadAnalyticsExcel(analytics: SurveyAnalyticsDto): Promise<void> {
    const blob = await generateAnalyticsExcelBlob(analytics);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = sanitizeFileName(analytics.surveyTitle || 'نظرسنجی');
    a.download = `تحلیل_${safeTitle}_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== ابزار مشترک ساخت شیت ====================

/**
 * ساخت یک worksheet با تنظیمات RTL و فونت پیش‌فرض
 */
function createSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
    const ws = workbook.addWorksheet(name, {
        views: [{ rightToLeft: true, showGridLines: true }],
    });
    return ws;
}

/**
 * اعمال استایل هدر (ردیف اول) روی یک شیت json-like
 */
function styleHeaderRow(ws: ExcelJS.Worksheet, rowNumber = 1): void {
    const row = ws.getRow(rowNumber);
    row.eachCell(cell => {
        cell.font = { name: FONT_NAME, bold: true, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: HEADER_FILL },
        };
        cell.border = {
            top: { style: 'thin' }, bottom: { style: 'thin' },
            left: { style: 'thin' }, right: { style: 'thin' },
        };
    });
    row.height = 22;
}

/**
 * اعمال فونت پیش‌فرض روی همه سلول‌های دارای مقدار در شیت
 */
function applyDefaultFont(ws: ExcelJS.Worksheet): void {
    ws.eachRow(row => {
        row.eachCell(cell => {
            if (!cell.font) {
                cell.font = { name: FONT_NAME, size: 11 };
            }
            if (!cell.alignment) {
                cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
            }
        });
    });
}

/**
 * تنظیم خودکار عرض ستون‌ها بر اساس بیشترین طول محتوا (با در نظر گرفتن حروف فارسی)
 */
function autoFitColumns(ws: ExcelJS.Worksheet, minWidth = 10, maxWidth = 60): void {
    ws.columns.forEach(column => {
        let maxLen = minWidth;
        column?.eachCell?.({ includeEmpty: true }, cell => {
            const val = cell.value;
            const text = val === null || val === undefined ? '' : String(val);
            // تخمین عرض: کاراکترهای فارسی/عربی کمی پهن‌تر رندر می‌شن
            const len = text.length * 1.15 + 2;
            if (len > maxLen) maxLen = len;
        });
        column.width = Math.min(maxLen, maxWidth);
    });
}

/** یک ردیف عنوان بزرگ (تیتر) در بالای شیت با ادغام سلول‌ها */
function addTitleRow(ws: ExcelJS.Worksheet, text: string, span: number): void {
    ws.mergeCells(1, 1, 1, span);
    const cell = ws.getCell(1, 1);
    cell.value = text;
    cell.font = { name: FONT_NAME, bold: true, size: 14 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;
}

// ==================== شیت ۱: نمای کلی ====================

/**
 * ✅ بازنویسی‌شده مطابق OverviewStatsDto جدید بک‌اند:
 * - دیگر Status/Device/Browser/OS/CompletionRate/Progress وجود ندارد (این نظرسنجی دیگر
 *   حالت InProgress/Draft ندارد و هیچ اطلاعات شناسایی‌کننده دستگاه ذخیره نمی‌شود).
 * - به‌جایش بریک‌داون‌های دموگرافیک k-anonymized (سن/جنسیت/شیفت/واحد) اضافه شده.
 */
function appendOverviewSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    const o = analytics.overview;
    const ws = createSheet(workbook, 'نمای کلی');
    ws.columns = [{ width: 34 }, { width: 30 }];

    let r = 1;
    const pushRow = (a: any, b?: any) => {
        ws.getRow(r).values = b === undefined ? [a] : [a, b];
        r++;
    };
    const pushSectionTitle = (title: string) => {
        ws.mergeCells(r, 1, r, 2);
        const cell = ws.getCell(r, 1);
        cell.value = title;
        cell.font = { name: FONT_NAME, bold: true, size: 12 };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
        r++;
    };
    const pushDemographicSection = (title: string, buckets?: DemographicBucketDto[]) => {
        if (!buckets || buckets.length === 0) return;
        pushSectionTitle(title);
        pushRow('دسته', 'تعداد (درصد)');
        buckets.forEach(b => pushRow(b.label, `${b.count} (${b.percentage}%)`));
        r++;
    };

    pushSectionTitle('گزارش تحلیل نظرسنجی');
    pushRow('عنوان نظرسنجی', analytics.surveyTitle);
    pushRow('تاریخ تولید گزارش', new Date().toLocaleDateString('fa-IR'));
    r++;

    pushSectionTitle('آمار کلی پاسخ‌ها');
    pushRow('شاخص', 'مقدار');
    pushRow('کل پاسخ‌ها', o.totalResponses);
    pushRow('میانگین زمان پاسخ‌دهی (دقیقه)', o.averageTimeSpentMinutes);
    if (o.fastestCompletionTimeText) pushRow('سریع‌ترین زمان تکمیل', o.fastestCompletionTimeText);
    if (o.medianCompletionTimeText) pushRow('میانه زمان تکمیل', o.medianCompletionTimeText);
    if (o.slowestCompletionTimeText) pushRow('کندترین زمان تکمیل', o.slowestCompletionTimeText);
    r++;

    pushDemographicSection('پاسخ‌ها به تفکیک سن', o.responsesByAge);
    pushDemographicSection('پاسخ‌ها به تفکیک جنسیت', o.responsesByGender);
    pushDemographicSection('پاسخ‌ها به تفکیک امور', o.responsesByOffice);
    pushDemographicSection('پاسخ‌ها به تفکیک نوع استخدام', o.responsesByEmploymentType);
    pushDemographicSection('پاسخ‌ها به تفکیک مدرک تحصیلی', o.responsesByEducation);
    pushDemographicSection('پاسخ‌ها به تفکیک نوبت‌کاری', o.responsesByShiftWorker);
    pushDemographicSection('پاسخ‌ها به تفکیک سابقه', o.responsesByExperienceYears);
    pushDemographicSection('پاسخ‌ها به تفکیک گرید سازمانی', o.responsesByOrganizationalGrade);
    pushDemographicSection('پاسخ‌ها به تفکیک گروه سازمانی', o.responsesByOrganizationalGroup);

    if (o.suppressedForPrivacy > 0) {
        pushSectionTitle('محرمانگی');
        pushRow(
            'تعداد پاسخ‌هایی که به‌دلیل کوچک بودن گروه، از بریک‌داون‌های بالا حذف شدند',
            o.suppressedForPrivacy
        );
        r++;
    }

    if (o.responsesByDayOfWeek.length > 0) {
        pushSectionTitle('پاسخ‌ها به تفکیک روز هفته');
        pushRow('روز', 'تعداد');
        o.responsesByDayOfWeek.forEach(p => pushRow(p.label, p.count));
        r++;
    }

    if (o.responsesByHourOfDay.length > 0) {
        pushSectionTitle('پاسخ‌ها به تفکیک ساعت روز');
        pushRow('ساعت', 'تعداد');
        o.responsesByHourOfDay.forEach(p => pushRow(p.label, p.count));
        r++;
    }

    if (o.responsesTrend.length > 0) {
        pushSectionTitle('روند پاسخ‌ها در طول زمان');
        pushRow('تاریخ', 'تعداد');
        o.responsesTrend.forEach(p => pushRow(p.label, p.count));
    }

    applyDefaultFont(ws);
    autoFitColumns(ws);
}

// ==================== شیت ۲: خلاصه سوالات ====================

function appendQuestionsSummarySheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    const ws = createSheet(workbook, 'خلاصه سوالات');
    ws.columns = [
        { header: 'ردیف', key: 'idx', width: 8 },
        { header: 'متن سوال', key: 'text', width: 50 },
        { header: 'نوع سوال', key: 'type', width: 22 },
        { header: 'الزامی', key: 'required', width: 10 },
        { header: 'تعداد پاسخ', key: 'answered', width: 14 },
        { header: 'تعداد رد شده', key: 'skipped', width: 14 },
        { header: 'نرخ پاسخ‌دهی (%)', key: 'rate', width: 16 },
    ];

    sortedQuestions(analytics).forEach((q, idx) => {
        ws.addRow({
            idx: idx + 1,
            text: q.questionText,
            type: q.questionTypeName,
            required: q.isRequired ? 'بله' : 'خیر',
            answered: q.totalAnswered,
            skipped: q.totalSkipped,
            rate: q.answerRate,
        });
    });

    styleHeaderRow(ws);
    applyDefaultFont(ws);
    autoFitColumns(ws);
}

// ==================== شیت ۳: آمار سوالات گزینه‌ای ====================

function appendChoiceStatsSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    const rows: any[] = [];
    for (const q of sortedQuestions(analytics)) {
        if (!q.optionStats || q.optionStats.length === 0) continue;
        for (const opt of q.optionStats) {
            rows.push({
                text: q.questionText,
                type: q.questionTypeName,
                option: opt.optionText,
                count: opt.count,
                percent: opt.percentage,
            });
        }
    }
    if (rows.length === 0) return;

    const ws = createSheet(workbook, 'آمار گزینه‌ای');
    ws.columns = [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'نوع سوال', key: 'type', width: 18 },
        { header: 'گزینه', key: 'option', width: 30 },
        { header: 'تعداد انتخاب', key: 'count', width: 14 },
        { header: 'درصد', key: 'percent', width: 10 },
    ];
    rows.forEach(r => ws.addRow(r));

    styleHeaderRow(ws);
    applyDefaultFont(ws);
    autoFitColumns(ws);
}

// ==================== شیت ۴: آمار سوالات عددی ====================

function appendNumericStatsSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    const rows: any[] = [];
    for (const q of sortedQuestions(analytics)) {
        if (!q.numericStats) continue;
        rows.push({
            text: q.questionText,
            type: q.questionTypeName,
            avg: q.numericStats.average,
            median: q.numericStats.median,
            min: q.numericStats.min,
            max: q.numericStats.max,
        });
    }
    if (rows.length > 0) {
        const ws = createSheet(workbook, 'آمار عددی');
        ws.columns = [
            { header: 'متن سوال', key: 'text', width: 45 },
            { header: 'نوع سوال', key: 'type', width: 18 },
            { header: 'میانگین', key: 'avg', width: 12 },
            { header: 'میانه', key: 'median', width: 12 },
            { header: 'حداقل', key: 'min', width: 12 },
            { header: 'حداکثر', key: 'max', width: 12 },
        ];
        rows.forEach(r => ws.addRow(r));
        styleHeaderRow(ws);
        applyDefaultFont(ws);
        autoFitColumns(ws);
    }

    // شیت جداگانه برای توزیع کامل هر سوال عددی (هیستوگرام)
    const distRows: any[] = [];
    for (const q of sortedQuestions(analytics)) {
        if (!q.numericStats || q.numericStats.distribution.length === 0) continue;
        for (const bucket of q.numericStats.distribution) {
            distRows.push({ text: q.questionText, value: bucket.label, count: bucket.count });
        }
    }
    if (distRows.length > 0) {
        const wsDist = createSheet(workbook, 'توزیع پاسخ‌های عددی');
        wsDist.columns = [
            { header: 'متن سوال', key: 'text', width: 45 },
            { header: 'مقدار', key: 'value', width: 14 },
            { header: 'تعداد', key: 'count', width: 10 },
        ];
        distRows.forEach(r => wsDist.addRow(r));
        styleHeaderRow(wsDist);
        applyDefaultFont(wsDist);
        autoFitColumns(wsDist);
    }
}

// ==================== شیت ۵: تحلیل احساسات پاسخ‌های متنی ====================

function appendTextSentimentSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    const rows: any[] = [];
    for (const q of sortedQuestions(analytics)) {
        if (!q.textAnalytics) continue;
        const s = q.textAnalytics.sentiment;
        rows.push({
            text: q.questionText,
            type: q.questionTypeName,
            answered: q.totalAnswered,
            posPct: s.positivePercentage,
            negPct: s.negativePercentage,
            neuPct: s.neutralPercentage,
            posCnt: s.positiveCount,
            negCnt: s.negativeCount,
            neuCnt: s.neutralCount,
            avgWords: q.textAnalytics.averageWordCount,
            avgChars: q.textAnalytics.averageCharCount,
        });
    }
    if (rows.length === 0) return;

    const ws = createSheet(workbook, 'احساس‌سنجی متنی');
    ws.columns = [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'نوع سوال', key: 'type', width: 18 },
        { header: 'تعداد پاسخ متنی', key: 'answered', width: 16 },
        { header: 'درصد مثبت', key: 'posPct', width: 12 },
        { header: 'درصد منفی', key: 'negPct', width: 12 },
        { header: 'درصد خنثی', key: 'neuPct', width: 12 },
        { header: 'تعداد مثبت', key: 'posCnt', width: 12 },
        { header: 'تعداد منفی', key: 'negCnt', width: 12 },
        { header: 'تعداد خنثی', key: 'neuCnt', width: 12 },
        { header: 'میانگین تعداد کلمات', key: 'avgWords', width: 18 },
        { header: 'میانگین تعداد کاراکتر', key: 'avgChars', width: 18 },
    ];
    rows.forEach(r => ws.addRow(r));

    styleHeaderRow(ws);
    applyDefaultFont(ws);
    autoFitColumns(ws);
}

// ==================== شیت ۶: کلمات پرتکرار ====================

function appendTopWordsSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    const rows: any[] = [];
    for (const q of sortedQuestions(analytics)) {
        if (!q.textAnalytics || q.textAnalytics.topWords.length === 0) continue;
        for (const w of q.textAnalytics.topWords) {
            rows.push({ text: q.questionText, word: w.word, count: w.count });
        }
    }
    if (rows.length === 0) return;

    const ws = createSheet(workbook, 'کلمات پرتکرار');
    ws.columns = [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'کلمه', key: 'word', width: 24 },
        { header: 'تعداد تکرار', key: 'count', width: 14 },
    ];
    rows.forEach(r => ws.addRow(r));

    styleHeaderRow(ws);
    applyDefaultFont(ws);
    autoFitColumns(ws);
}

// ==================== شیت ۷: نمونه پاسخ‌های متنی ====================

function appendTextSamplesSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    const rows: any[] = [];
    const sentimentLabel: Record<string, string> = {
        positive: 'مثبت',
        negative: 'منفی',
        neutral: 'خنثی',
    };

    for (const q of sortedQuestions(analytics)) {
        if (!q.textAnalytics) continue;

        if (q.textAnalytics.sentiment.samples.length > 0) {
            for (const sample of q.textAnalytics.sentiment.samples) {
                rows.push({
                    text: q.questionText,
                    answer: sample.text,
                    sentiment: sentimentLabel[sample.sentiment] || sample.sentiment,
                });
            }
        } else {
            for (const answer of q.textAnalytics.sampleAnswers) {
                rows.push({ text: q.questionText, answer, sentiment: '-' });
            }
        }
    }
    if (rows.length === 0) return;

    const ws = createSheet(workbook, 'نمونه پاسخ‌های متنی');
    ws.columns = [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'پاسخ', key: 'answer', width: 60 },
        { header: 'احساس', key: 'sentiment', width: 10 },
    ];
    rows.forEach(r => ws.addRow(r));

    styleHeaderRow(ws);
    applyDefaultFont(ws);
    autoFitColumns(ws, 10, 80); // ستون پاسخ می‌تونه طولانی باشه
}

// ==================== شیت ۸: آمار رتبه‌بندی ====================

function appendRankingSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    const rows: any[] = [];
    for (const q of sortedQuestions(analytics)) {
        if (!q.rankingStats || q.rankingStats.length === 0) continue;
        for (const r of q.rankingStats) {
            rows.push({
                text: q.questionText,
                item: r.itemLabel,
                avgRank: r.averageRank,
                count: r.count,
            });
        }
    }
    if (rows.length === 0) return;

    const ws = createSheet(workbook, 'آمار رتبه‌بندی');
    ws.columns = [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'آیتم', key: 'item', width: 30 },
        { header: 'میانگین رتبه (کمتر = بهتر)', key: 'avgRank', width: 24 },
        { header: 'تعداد پاسخ', key: 'count', width: 14 },
    ];
    rows.forEach(r => ws.addRow(r));

    styleHeaderRow(ws);
    applyDefaultFont(ws);
    autoFitColumns(ws);
}

// ==================== Helpers ====================

function sortedQuestions(analytics: SurveyAnalyticsDto): QuestionAnalyticsDto[] {
    return [...analytics.questions].sort((a, b) => a.sortOrder - b.sortOrder);
}

function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}