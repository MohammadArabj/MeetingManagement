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
    QuestionStepGroup,
    groupQuestionsByStep,
    surveyHasSteps,
    stepDisplayTitle,
    sentimentLabelFa,
    formatSigned,
} from '../../core/models/survey-analytics.model';

const FONT_NAME = 'BNazanin';
const HEADER_FILL = 'FFEFEFEF';
const STEP_FILL = 'FFE8EEFB';
const STEP_FONT_COLOR = 'FF1E3A8A';

/**
 * ساخت Workbook کامل تحلیل نظرسنجی (چند شیت) و برگرداندن آن به‌صورت Blob
 */
export async function generateAnalyticsExcelBlob(analytics: SurveyAnalyticsDto): Promise<Blob> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'سامانه نظرسنجی';
    workbook.created = new Date();

    appendOverviewSheet(workbook, analytics);
    appendStepsSummarySheet(workbook, analytics);
    appendQuestionsSummarySheet(workbook, analytics);
    appendChoiceStatsSheet(workbook, analytics);
    appendNumericStatsSheet(workbook, analytics);
    appendRankingSheet(workbook, analytics);
    appendTextSummarySheet(workbook, analytics);
    appendTextThemesSheet(workbook, analytics);
    appendTextKeywordsSheet(workbook, analytics);
    appendSuggestionsSheet(workbook, analytics);
    appendRepeatedAnswersSheet(workbook, analytics);
    appendTextAnswersSheet(workbook, analytics);

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
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ==================== ابزار مشترک ساخت شیت ====================

/**
 * ساخت یک worksheet با تنظیمات RTL و فونت پیش‌فرض
 */
function createSheet(workbook: ExcelJS.Workbook, name: string, freezeHeader = false): ExcelJS.Worksheet {
    const ws = workbook.addWorksheet(name, {
        views: freezeHeader
            ? [{ rightToLeft: true, showGridLines: true, state: 'frozen', ySplit: 1 }]
            : [{ rightToLeft: true, showGridLines: true }],
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
function autoFitColumns(ws: ExcelJS.Worksheet, minWidth = 10, maxWidth = 60, skipRows?: Set<number>): void {
    ws.columns.forEach(column => {
        let maxLen = minWidth;
        column?.eachCell?.({ includeEmpty: true }, (cell, rowNumber) => {
            if (skipRows?.has(rowNumber)) return;
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

// ==================== گروه‌بندی بر اساس گام ====================

interface ColumnDef {
    header: string;
    key: string;
    width: number;
}

/** متن خلاصه‌ی یک گام برای ردیف سرتیتر */
function stepSummaryText(g: QuestionStepGroup): string {
    const parts: string[] = [stepDisplayTitle(g)];
    const c = g.criterion;
    parts.push(`${c?.questionCount ?? g.questions.length} سوال`);
    if (c) {
        parts.push(`نرخ پاسخ‌دهی ${c.averageAnswerRate}%`);
        if (c.averageScorePercent !== null && c.averageScorePercent !== undefined) {
            parts.push(`امتیاز ${c.averageScorePercent}%`);
        }
        if (c.netSentiment !== null && c.netSentiment !== undefined) {
            parts.push(`شاخص احساس ${formatSigned(c.netSentiment)}`);
        }
    }
    return parts.join('  |  ');
}

/**
 * ساخت یک شیت جدولی که ردیف‌هایش به تفکیک گام گروه‌بندی شده‌اند.
 * اگر نظرسنجی گام داشته باشد: ستون «گام» به ابتدای جدول اضافه می‌شود و قبل از ردیف‌های هر گام
 * یک ردیف سرتیتر (ادغام‌شده) با خلاصه‌ی گام درج می‌شود.
 * اگر هیچ ردیفی وجود نداشته باشد شیت ساخته نمی‌شود.
 */
function appendGroupedSheet(
    workbook: ExcelJS.Workbook,
    analytics: SurveyAnalyticsDto,
    sheetName: string,
    columns: ColumnDef[],
    rowsFor: (q: QuestionAnalyticsDto) => Record<string, unknown>[],
    maxWidth = 60
): void {
    const hasSteps = surveyHasSteps(analytics);
    const groups = groupQuestionsByStep(analytics);
    const grouped = groups
        .map(g => ({ g, rows: g.questions.flatMap(q => rowsFor(q)) }))
        .filter(x => x.rows.length > 0);
    if (grouped.length === 0) return;

    const ws = createSheet(workbook, sheetName, true);
    const cols: ColumnDef[] = hasSteps ? [{ header: 'گام', key: '__step', width: 22 }, ...columns] : columns;
    ws.columns = cols.map(c => ({ header: c.header, key: c.key, width: c.width }));
    styleHeaderRow(ws);

    const stepRows = new Set<number>();
    for (const { g, rows } of grouped) {
        if (hasSteps) {
            const row = ws.addRow([stepSummaryText(g)]);
            const r = row.number;
            ws.mergeCells(r, 1, r, cols.length);
            const cell = ws.getCell(r, 1);
            cell.font = { name: FONT_NAME, bold: true, size: 12, color: { argb: STEP_FONT_COLOR } };
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STEP_FILL } };
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
            row.height = 22;
            stepRows.add(r);
        }
        const stepLabel = g.index === null ? g.title : `${g.index}. ${g.title}`;
        for (const r of rows) {
            ws.addRow(hasSteps ? { __step: stepLabel, ...r } : r);
        }
    }

    applyDefaultFont(ws);
    autoFitColumns(ws, 10, maxWidth, stepRows);
}

// ==================== شیت: خلاصه گام‌ها ====================

function appendStepsSummarySheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    if (!surveyHasSteps(analytics)) return;
    const groups = groupQuestionsByStep(analytics, analytics.questions, true);

    const ws = createSheet(workbook, 'خلاصه گام‌ها', true);
    ws.columns = [
        { header: 'شماره گام', key: 'idx', width: 10 },
        { header: 'عنوان گام', key: 'title', width: 36 },
        { header: 'تعداد سوال', key: 'count', width: 12 },
        { header: 'میانگین نرخ پاسخ‌دهی (%)', key: 'rate', width: 22 },
        { header: 'میانگین امتیاز (۰ تا ۱۰۰)', key: 'score', width: 22 },
        { header: 'شاخص خالص احساس (−۱۰۰ تا +۱۰۰)', key: 'net', width: 26 },
        { header: 'سوال‌های متنی', key: 'texts', width: 14 },
    ];

    for (const g of groups) {
        const c = g.criterion;
        ws.addRow({
            idx: g.index ?? '-',
            title: g.title,
            count: c?.questionCount ?? g.questions.length,
            rate: c?.averageAnswerRate ?? '-',
            score: c?.averageScorePercent ?? '-',
            net: c?.netSentiment ?? '-',
            texts: g.questions.filter(q => !!q.textAnalytics).length,
        });
    }

    styleHeaderRow(ws);
    applyDefaultFont(ws);
    autoFitColumns(ws);
}

// ==================== شیت: خلاصه سوالات ====================

function appendQuestionsSummarySheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    let idx = 0;
    appendGroupedSheet(workbook, analytics, 'خلاصه سوالات', [
        { header: 'ردیف', key: 'idx', width: 8 },
        { header: 'متن سوال', key: 'text', width: 50 },
        { header: 'نوع سوال', key: 'type', width: 22 },
        { header: 'الزامی', key: 'required', width: 10 },
        { header: 'تعداد پاسخ', key: 'answered', width: 14 },
        { header: 'تعداد رد شده', key: 'skipped', width: 14 },
        { header: 'نرخ پاسخ‌دهی (%)', key: 'rate', width: 16 },
        { header: 'شاخص اصلی', key: 'headline', width: 30 },
    ], q => [{
        idx: ++idx,
        text: q.questionText,
        type: q.questionTypeName,
        required: q.isRequired ? 'بله' : 'خیر',
        answered: q.totalAnswered,
        skipped: q.totalSkipped,
        rate: q.answerRate,
        headline: headlineFor(q),
    }]);
}

/** یک شاخص خلاصه برای هر سوال (برای مرور سریع) */
function headlineFor(q: QuestionAnalyticsDto): string {
    if (q.numericStats) return `میانگین ${q.numericStats.average} · میانه ${q.numericStats.median}`;
    if (q.optionStats && q.optionStats.length > 0) {
        const top = [...q.optionStats].sort((a, b) => b.count - a.count)[0];
        return `بیشترین: ${top.optionText} (${top.percentage}%)`;
    }
    if (q.textAnalytics) {
        const s = q.textAnalytics.sentiment;
        const net = s.netSentiment ?? (s.positivePercentage - s.negativePercentage);
        const theme = q.textAnalytics.themes?.[0];
        return `احساس ${formatSigned(net)}` + (theme ? ` · موضوع اصلی: ${theme.title}` : '');
    }
    if (q.rankingStats && q.rankingStats.length > 0) {
        const top = [...q.rankingStats].sort((a, b) => a.averageRank - b.averageRank)[0];
        return `رتبه اول: ${top.itemLabel}`;
    }
    if (q.fileUploadCount !== undefined && q.fileUploadCount !== null) return `${q.fileUploadCount} فایل`;
    return '';
}

// ==================== شیت: آمار سوالات گزینه‌ای ====================

function appendChoiceStatsSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    appendGroupedSheet(workbook, analytics, 'آمار گزینه‌ای', [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'نوع سوال', key: 'type', width: 18 },
        { header: 'گزینه', key: 'option', width: 30 },
        { header: 'تعداد انتخاب', key: 'count', width: 14 },
        { header: 'درصد', key: 'percent', width: 10 },
    ], q => (q.optionStats ?? []).map(opt => ({
        text: q.questionText,
        type: q.questionTypeName,
        option: opt.optionText,
        count: opt.count,
        percent: opt.percentage,
    })));
}

// ==================== شیت: آمار سوالات عددی ====================

function appendNumericStatsSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    appendGroupedSheet(workbook, analytics, 'آمار عددی', [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'نوع سوال', key: 'type', width: 18 },
        { header: 'تعداد پاسخ', key: 'answered', width: 12 },
        { header: 'میانگین', key: 'avg', width: 12 },
        { header: 'میانه', key: 'median', width: 12 },
        { header: 'حداقل', key: 'min', width: 12 },
        { header: 'حداکثر', key: 'max', width: 12 },
    ], q => q.numericStats ? [{
        text: q.questionText,
        type: q.questionTypeName,
        answered: q.totalAnswered,
        avg: q.numericStats.average,
        median: q.numericStats.median,
        min: q.numericStats.min,
        max: q.numericStats.max,
    }] : []);

    appendGroupedSheet(workbook, analytics, 'توزیع پاسخ‌های عددی', [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'مقدار', key: 'value', width: 14 },
        { header: 'تعداد', key: 'count', width: 10 },
    ], q => (q.numericStats?.distribution ?? []).map(b => ({ text: q.questionText, value: b.label, count: b.count })));
}

// ==================== شیت: آمار رتبه‌بندی ====================

function appendRankingSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    appendGroupedSheet(workbook, analytics, 'آمار رتبه‌بندی', [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'آیتم', key: 'item', width: 30 },
        { header: 'میانگین رتبه (کمتر = بهتر)', key: 'avgRank', width: 24 },
        { header: 'تعداد پاسخ', key: 'count', width: 14 },
    ], q => (q.rankingStats ?? []).map(r => ({
        text: q.questionText,
        item: r.itemLabel,
        avgRank: r.averageRank,
        count: r.count,
    })));
}

// ==================== شیت‌های تحلیل متنی ====================

function appendTextSummarySheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    appendGroupedSheet(workbook, analytics, 'تحلیل متنی - خلاصه', [
        { header: 'متن سوال', key: 'text', width: 45 },
        { header: 'کل پاسخ‌های متنی', key: 'total', width: 14 },
        { header: 'دارای محتوا', key: 'meaningful', width: 12 },
        { header: 'بی‌محتوا', key: 'emptyLike', width: 10 },
        { header: 'میانه کلمات', key: 'medianWords', width: 12 },
        { header: 'میانگین کلمات', key: 'avgWords', width: 12 },
        { header: 'مثبت', key: 'pos', width: 12 },
        { header: 'دوگانه', key: 'mix', width: 12 },
        { header: 'خنثی', key: 'neu', width: 12 },
        { header: 'منفی', key: 'neg', width: 12 },
        { header: 'شاخص خالص احساس', key: 'net', width: 16 },
        { header: 'میانگین امتیاز احساس (−۵ تا +۵)', key: 'avgScore', width: 18 },
        { header: 'تعداد پیشنهاد', key: 'sugg', width: 12 },
        { header: 'موضوعات اصلی', key: 'themes', width: 40 },
    ], q => {
        const t = q.textAnalytics;
        if (!t) return [];
        const s = t.sentiment;
        const fmt = (count: number | undefined, pct: number | undefined) => `${count ?? 0} (${pct ?? 0}%)`;
        return [{
            text: q.questionText,
            total: t.totalTextAnswers ?? q.totalAnswered,
            meaningful: t.meaningfulCount ?? '-',
            emptyLike: t.emptyLikeCount ?? '-',
            medianWords: t.medianWordCount ?? '-',
            avgWords: t.averageWordCount,
            pos: fmt(s.positiveCount, s.positivePercentage),
            mix: fmt(s.mixedCount, s.mixedPercentage),
            neu: fmt(s.neutralCount, s.neutralPercentage),
            neg: fmt(s.negativeCount, s.negativePercentage),
            net: s.netSentiment ?? Math.round((s.positivePercentage - s.negativePercentage) * 10) / 10,
            avgScore: s.averageScore ?? '-',
            sugg: t.suggestionCount ?? (t.suggestions?.length ?? 0),
            themes: (t.themes ?? []).slice(0, 5).map(th => `${th.title} (${th.count})`).join('، '),
        }];
    });
}

function appendTextThemesSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    appendGroupedSheet(workbook, analytics, 'موضوعات پاسخ‌های متنی', [
        { header: 'متن سوال', key: 'text', width: 40 },
        { header: 'موضوع', key: 'theme', width: 22 },
        { header: 'تعداد پاسخ', key: 'count', width: 12 },
        { header: 'درصد', key: 'percent', width: 10 },
        { header: 'مثبت', key: 'pos', width: 10 },
        { header: 'منفی', key: 'neg', width: 10 },
        { header: 'نمونه پاسخ‌ها', key: 'samples', width: 70 },
    ], q => (q.textAnalytics?.themes ?? []).map(t => ({
        text: q.questionText,
        theme: t.title,
        count: t.count,
        percent: t.percentage,
        pos: t.positiveCount,
        neg: t.negativeCount,
        samples: (t.samples ?? []).slice(0, 3).join('\n— '),
    })), 80);
}

function appendTextKeywordsSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    appendGroupedSheet(workbook, analytics, 'کلیدواژه‌ها و عبارت‌ها', [
        { header: 'متن سوال', key: 'text', width: 40 },
        { header: 'نوع', key: 'kind', width: 12 },
        { header: 'واژه / عبارت', key: 'term', width: 28 },
        { header: 'تعداد پاسخ‌های شامل', key: 'docs', width: 18 },
        { header: 'تعداد تکرار', key: 'count', width: 12 },
    ], q => {
        const t = q.textAnalytics;
        if (!t) return [];
        const kws = (t.keywords && t.keywords.length > 0)
            ? t.keywords.map(k => ({ text: q.questionText, kind: 'کلیدواژه', term: k.term, docs: k.documentCount, count: k.count }))
            : (t.topWords ?? []).map(w => ({ text: q.questionText, kind: 'کلمه پرتکرار', term: w.word, docs: '-', count: w.count }));
        const phrases = (t.phrases ?? []).map(p => ({ text: q.questionText, kind: 'عبارت', term: p.term, docs: p.documentCount, count: p.count }));
        return [...kws, ...phrases];
    });
}

function appendSuggestionsSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    appendGroupedSheet(workbook, analytics, 'پیشنهادها', [
        { header: 'متن سوال', key: 'text', width: 40 },
        { header: 'ردیف', key: 'idx', width: 8 },
        { header: 'پیشنهاد', key: 'suggestion', width: 80 },
    ], q => (q.textAnalytics?.suggestions ?? []).map((s, i) => ({ text: q.questionText, idx: i + 1, suggestion: s })), 90);
}

function appendRepeatedAnswersSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    appendGroupedSheet(workbook, analytics, 'پاسخ‌های تکراری', [
        { header: 'متن سوال', key: 'text', width: 40 },
        { header: 'پاسخ', key: 'answer', width: 50 },
        { header: 'تعداد تکرار', key: 'count', width: 12 },
    ], q => (q.textAnalytics?.repeatedAnswers ?? []).map(r => ({ text: q.questionText, answer: r.word, count: r.count })));
}

function appendTextAnswersSheet(workbook: ExcelJS.Workbook, analytics: SurveyAnalyticsDto): void {
    appendGroupedSheet(workbook, analytics, 'پاسخ‌های متنی', [
        { header: 'متن سوال', key: 'text', width: 40 },
        { header: 'پاسخ', key: 'answer', width: 70 },
        { header: 'احساس', key: 'sentiment', width: 10 },
        { header: 'امتیاز احساس', key: 'score', width: 12 },
        { header: 'تعداد کلمات', key: 'words', width: 12 },
        { header: 'موضوعات', key: 'themes', width: 26 },
        { header: 'پیشنهاد؟', key: 'sugg', width: 10 },
    ], q => {
        const t = q.textAnalytics;
        if (!t) return [];
        if (t.answers && t.answers.length > 0) {
            const titles = new Map((t.themes ?? []).map(th => [th.key, th.title] as const));
            return t.answers.map(a => ({
                text: q.questionText,
                answer: a.text,
                sentiment: sentimentLabelFa(a.sentiment),
                score: a.score,
                words: a.wordCount,
                themes: (a.themes ?? []).map(k => titles.get(k) ?? k).join('، '),
                sugg: a.isSuggestion ? 'بله' : '',
            }));
        }
        // داده‌ی قدیمی: فقط نمونه‌ها
        if (t.sentiment.samples.length > 0) {
            return t.sentiment.samples.map(sm => ({
                text: q.questionText, answer: sm.text, sentiment: sentimentLabelFa(sm.sentiment),
                score: '-', words: '-', themes: '', sugg: '',
            }));
        }
        return (t.sampleAnswers ?? []).map(a => ({
            text: q.questionText, answer: a, sentiment: '-', score: '-', words: '-', themes: '', sugg: '',
        }));
    }, 90);
}

// ==================== Helpers ====================

function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}
