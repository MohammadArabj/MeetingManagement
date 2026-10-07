


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
    samples: SentimentAnswerDto[];
}

export interface TextAnalyticsDto {
    sampleAnswers: string[];
    topWords: { word: string; count: number }[];
    averageWordCount: number;
    averageCharCount: number;
    sentiment: SentimentStatsDto;
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
    questions: QuestionAnalyticsDto[];
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

// بقیهٔ اینترفیس‌ها (QuestionAnalyticsDto, OptionStatDto, ...) بدون تغییر نسبت به قبل باقی می‌مانند