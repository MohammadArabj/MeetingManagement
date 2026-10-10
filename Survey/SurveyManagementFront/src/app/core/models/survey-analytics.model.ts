


export interface OptionStatDto {
    optionText: string;
    count: number;
    percentage: number;
    color?: string;
}

export interface HistogramBucketDto {
    label: string;
    count: number;
}

export interface NumericStatDto {
    average: number;
    min: number;
    max: number;
    median: number;
    distribution: HistogramBucketDto[];
}

export type TextSentiment = 'positive' | 'negative' | 'neutral' | 'mixed' | 'empty';

export interface SentimentAnswerDto {
    text: string;
    sentiment: string;
}

export interface SentimentStatsDto {
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    positivePercentage: number;
    negativePercentage: number;
    neutralPercentage: number;
    /** پاسخ‌هایی که هم نکته‌ی مثبت و هم منفی دارند */
    mixedCount?: number;
    mixedPercentage?: number;
    /** میانگین امتیاز احساس (-۵ تا +۵) */
    averageScore?: number;
    /** درصد مثبت منهای درصد منفی (-۱۰۰ تا +۱۰۰) */
    netSentiment?: number;
    samples: SentimentAnswerDto[];
}

export interface WordFrequencyDto {
    word: string;
    count: number;
}

export interface KeywordDto {
    term: string;
    count: number;
    /** تعداد پاسخ‌هایی که واژه/عبارت در آن آمده */
    documentCount: number;
    score: number;
}

export interface TextThemeDto {
    key: string;
    title: string;
    count: number;
    percentage: number;
    positiveCount: number;
    negativeCount: number;
    samples: string[];
}

export interface TextAnswerItemDto {
    text: string;
    sentiment: TextSentiment | string;
    score: number;
    wordCount: number;
    /** کلید موضوعات (TextThemeDto.key) */
    themes: string[];
    isSuggestion: boolean;
}

export interface TextAnalyticsDto {
    sampleAnswers: string[];
    topWords: WordFrequencyDto[];
    averageWordCount: number;
    averageCharCount: number;
    sentiment: SentimentStatsDto;

    totalTextAnswers?: number;
    meaningfulCount?: number;
    emptyLikeCount?: number;
    medianWordCount?: number;
    lengthDistribution?: HistogramBucketDto[];
    keywords?: KeywordDto[];
    phrases?: KeywordDto[];
    themes?: TextThemeDto[];
    suggestionCount?: number;
    suggestions?: string[];
    repeatedAnswers?: WordFrequencyDto[];
    answers?: TextAnswerItemDto[];
}

/** خلاصه‌ی هر گام/معیار نظرسنجی */
export interface CriterionAnalyticsDto {
    /** null یعنی گروه «سایر سوالات» (سوال‌های بدون گام) */
    guid: string | null;
    title: string;
    sortOrder: number;
    questionCount: number;
    averageAnswerRate: number;
    /** میانگین نرمال‌شده‌ی سوال‌های امتیازی (۰ تا ۱۰۰) */
    averageScorePercent: number | null;
    /** شاخص خالص احساس پاسخ‌های متنی (-۱۰۰ تا +۱۰۰) */
    netSentiment: number | null;
    questionGuids: string[];
}

// ⚠️ فرض شده که رکورد بک‌اند RankingStatDto از الگوی بقیه‌ی DTOها (TrendPointDto,
// OptionStatDto, HistogramBucketDto, DemographicBucketDto) پیروی می‌کنه و پراپرتی
// سوم رو "Count" نام‌گذاری کرده، نه "TotalRanked". حتماً با تعریف رکورد
// RankingStatDto سمت C# چک کن؛ اگه اونجا واقعاً TotalRanked بود این‌جا هم برگردون.
export interface RankingStatDto {
    itemLabel: string;
    averageRank: number;
    count: number;
}

export interface QuestionAnalyticsDto {
    questionGuid: string;
    questionText: string;
    questionType: number;
    questionTypeName: string;
    sortOrder: number;
    isRequired: boolean;
    /** گام/معیار سوال (null یعنی بدون گام) */
    criterionGuid?: string | null;
    criterionTitle?: string | null;
    criterionSortOrder?: number | null;
    totalAnswered: number;
    totalSkipped: number;
    answerRate: number;
    optionStats?: OptionStatDto[];
    numericStats?: NumericStatDto;
    textAnalytics?: TextAnalyticsDto;
    dateDistribution?: TrendPointDto[];
    fileUploadCount?: number;
    rankingStats?: RankingStatDto[];
}

export interface SurveyAnalyticsDto {
    surveyGuid: string;
    surveyTitle: string;
    overview: OverviewStatsDto;
    /** سوال‌ها به ترتیب گام و سپس ترتیب سوال می‌آیند */
    questions: QuestionAnalyticsDto[];
    /** گام‌های نظرسنجی؛ خالی یعنی نظرسنجی بدون گام */
    criteria?: CriterionAnalyticsDto[];
}

export interface DemographicBucketDto {
    label: string;
    count: number;
    percentage: number;
}

export interface TrendPointDto {
    label: string;
    count: number;
}

export interface OverviewStatsDto {
    totalResponses: number;
    averageTimeSpentMinutes: number;
    fastestCompletionTimeText?: string;
    slowestCompletionTimeText?: string;
    medianCompletionTimeText?: string;

    responsesByAge: DemographicBucketDto[];
    responsesByGender: DemographicBucketDto[];
    responsesByOffice: DemographicBucketDto[];
    responsesByEmploymentType: DemographicBucketDto[];
    responsesByEducation: DemographicBucketDto[];
    responsesByShiftWorker: DemographicBucketDto[];
    responsesByExperienceYears: DemographicBucketDto[];
    responsesByOrganizationalGrade: DemographicBucketDto[];
    responsesByOrganizationalGroup: DemographicBucketDto[];

    responsesTrend: TrendPointDto[];
    responsesByHourOfDay: TrendPointDto[];
    responsesByDayOfWeek: TrendPointDto[];
    suppressedForPrivacy: number;
}


// ==================== گروه‌بندی سوال‌ها بر اساس گام ====================

export const OTHER_STEP_TITLE = 'سایر سوالات';
export const OTHER_STEP_KEY = '__other__';

export interface QuestionStepGroup {
    /** کلید پایدار گروه (guid گام یا OTHER_STEP_KEY) */
    key: string;
    title: string;
    /** شماره‌ی نمایشی گام (۱، ۲، …)؛ برای «سایر سوالات» null */
    index: number | null;
    /** خلاصه‌ی گام از سرور (اگر موجود باشد) */
    criterion: CriterionAnalyticsDto | null;
    questions: QuestionAnalyticsDto[];
}

/** آیا نظرسنجی گام‌بندی شده است؟ */
export function surveyHasSteps(analytics: SurveyAnalyticsDto | null | undefined): boolean {
    return (analytics?.criteria?.length ?? 0) > 0;
}

/**
 * گروه‌بندی سوال‌ها بر اساس گام، به ترتیب گام‌ها.
 * سوال‌هایی که در هیچ گامی نیستند در گروه «سایر سوالات» (انتهای لیست) قرار می‌گیرند.
 * ترتیب سوال‌ها داخل هر گروه همان ترتیب ورودی (ترتیب سرور) است.
 * اگر نظرسنجی گام نداشته باشد، یک گروه بدون عنوان با همه‌ی سوال‌ها برمی‌گردد.
 */
export function groupQuestionsByStep(
    analytics: SurveyAnalyticsDto,
    questions: QuestionAnalyticsDto[] = analytics.questions,
    keepEmptyGroups = false
): QuestionStepGroup[] {
    const criteria = [...(analytics.criteria ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    if (criteria.length === 0) {
        return [{ key: 'all', title: '', index: null, criterion: null, questions: [...questions] }];
    }

    const groups: QuestionStepGroup[] = [];
    const byKey = new Map<string, QuestionStepGroup>();
    const keyByQuestion = new Map<string, string>();
    let stepNo = 0;

    for (const c of criteria) {
        const isOther = !c.guid;
        const key = isOther ? OTHER_STEP_KEY : c.guid!;
        if (byKey.has(key)) continue;
        const g: QuestionStepGroup = {
            key,
            title: isOther ? (c.title || OTHER_STEP_TITLE) : c.title,
            index: isOther ? null : ++stepNo,
            criterion: c,
            questions: []
        };
        byKey.set(key, g);
        groups.push(g);
        for (const qg of c.questionGuids ?? []) keyByQuestion.set(qg, key);
    }

    for (const q of questions) {
        let key = keyByQuestion.get(q.questionGuid) ?? (q.criterionGuid && byKey.has(q.criterionGuid) ? q.criterionGuid : null);
        if (!key) {
            key = OTHER_STEP_KEY;
            if (!byKey.has(key)) {
                const other: QuestionStepGroup = { key, title: OTHER_STEP_TITLE, index: null, criterion: null, questions: [] };
                byKey.set(key, other);
                groups.push(other);
            }
        }
        byKey.get(key)!.questions.push(q);
    }

    // «سایر سوالات» همیشه در انتها
    groups.sort((a, b) => (a.key === OTHER_STEP_KEY ? 1 : 0) - (b.key === OTHER_STEP_KEY ? 1 : 0));
    return keepEmptyGroups ? groups : groups.filter(g => g.questions.length > 0);
}

/** عنوان کامل گام برای نمایش/خروجی: «گام ۲ — عنوان» */
export function stepDisplayTitle(g: QuestionStepGroup): string {
    if (g.index === null) return g.title || OTHER_STEP_TITLE;
    return `گام ${g.index} — ${g.title}`;
}

/** برچسب فارسی احساس */
export function sentimentLabelFa(sentiment: string | null | undefined): string {
    switch (sentiment) {
        case 'positive': return 'مثبت';
        case 'negative': return 'منفی';
        case 'mixed': return 'دوگانه';
        case 'empty': return 'بی‌محتوا';
        default: return 'خنثی';
    }
}

/** فرمت عدد علامت‌دار (مثلاً +۱۲ یا −۵) */
export function formatSigned(value: number | null | undefined, digits = 0): string {
    if (value === null || value === undefined || isNaN(Number(value))) return '—';
    const v = Number(value);
    const fixed = Math.abs(v).toFixed(digits);
    if (v > 0) return `+${fixed}`;
    if (v < 0) return `−${fixed}`;
    return fixed;
}
