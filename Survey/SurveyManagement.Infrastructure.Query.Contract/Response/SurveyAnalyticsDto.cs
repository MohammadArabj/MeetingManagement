// SurveyManagement.Infrastructure.Query.Contract.Response/SurveyAnalyticsDto.cs

namespace SurveyManagement.Infrastructure.Query.Contract.Response;
public record GetSurveyAnalyticsRequest(Guid SurveyGuid);

public class SurveyAnalyticsDto
{
    public Guid SurveyGuid { get; set; }
    public string SurveyTitle { get; set; } = string.Empty;
    public OverviewStatsDto Overview { get; set; } = new();
    public List<QuestionAnalyticsDto> Questions { get; set; } = new();

    /// <summary>گام‌ها/معیارهای نظرسنجی با خلاصه‌ی هر کدام (خالی یعنی نظرسنجی بدون گام)</summary>
    public List<CriterionAnalyticsDto> Criteria { get; set; } = new();
}

public class OverviewStatsDto
{
    public int TotalResponses { get; set; }
    public decimal AverageTimeSpentMinutes { get; set; }
    public string? FastestCompletionTimeText { get; set; }
    public string? SlowestCompletionTimeText { get; set; }
    public string? MedianCompletionTimeText { get; set; }

    // ✅ بریک‌داون کامل روی هر ۹ بعد دموگرافیک — با suppression بر اساس k-anonymity
    public List<DemographicBucketDto> ResponsesByAge { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByGender { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByOffice { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByEmploymentType { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByEducation { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByShiftWorker { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByExperienceYears { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByOrganizationalGrade { get; set; } = new();
    public List<DemographicBucketDto> ResponsesByOrganizationalGroup { get; set; } = new();

    public List<TrendPointDto> ResponsesTrend { get; set; } = new();
    public List<TrendPointDto> ResponsesByHourOfDay { get; set; } = new();
    public List<TrendPointDto> ResponsesByDayOfWeek { get; set; } = new();

    public int SuppressedForPrivacy { get; set; }
}

public record DemographicBucketDto(string Label, int Count, decimal Percentage);
public record TrendPointDto(string Label, int Count);

public class QuestionAnalyticsDto
{
    public Guid QuestionGuid { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public int QuestionType { get; set; }
    public string QuestionTypeName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }

    /// <summary>گام/معیاری که سوال در آن است (null یعنی بدون گام)</summary>
    public Guid? CriterionGuid { get; set; }
    public string? CriterionTitle { get; set; }
    public int? CriterionSortOrder { get; set; }

    public int TotalAnswered { get; set; }
    public int TotalSkipped { get; set; }
    public decimal AnswerRate { get; set; }
    public List<OptionStatDto>? OptionStats { get; set; }
    public NumericStatDto? NumericStats { get; set; }
    public TextAnalyticsDto? TextAnalytics { get; set; }
    public List<TrendPointDto>? DateDistribution { get; set; }
    public int? FileUploadCount { get; set; }
    public List<RankingStatDto>? RankingStats { get; set; }
}

public record OptionStatDto
{
    public string OptionText { get; init; } = string.Empty;
    public int Count { get; init; }
    public decimal Percentage { get; init; }
    public string? Color { get; init; }
}

public class NumericStatDto
{
    public decimal Average { get; set; }
    public decimal Min { get; set; }
    public decimal Max { get; set; }
    public decimal Median { get; set; }
    public List<HistogramBucketDto> Distribution { get; set; } = new();
}

public record HistogramBucketDto(string Label, int Count);

public class TextAnalyticsDto
{
    public List<string> SampleAnswers { get; set; } = new();
    public List<WordFrequencyDto> TopWords { get; set; } = new();
    public SentimentSummaryDto Sentiment { get; set; } = new();
    public decimal AverageWordCount { get; set; }
    public decimal AverageCharCount { get; set; }

    public int TotalTextAnswers { get; set; }

    /// <summary>پاسخ‌های دارای محتوا (بدون «ندارم»، «-» و …)</summary>
    public int MeaningfulCount { get; set; }
    public int EmptyLikeCount { get; set; }
    public decimal MedianWordCount { get; set; }
    public List<HistogramBucketDto> LengthDistribution { get; set; } = new();

    /// <summary>کلیدواژه‌های شاخص (DocumentCount = تعداد پاسخ‌هایی که واژه در آن آمده)</summary>
    public List<KeywordDto> Keywords { get; set; } = new();

    /// <summary>عبارت‌های پرتکرار دو و سه‌کلمه‌ای</summary>
    public List<KeywordDto> Phrases { get; set; } = new();

    /// <summary>موضوعات (حقوق، مدیریت، محیط کار، …) با تعداد و نمونه</summary>
    public List<TextThemeDto> Themes { get; set; } = new();

    public int SuggestionCount { get; set; }
    public List<string> Suggestions { get; set; } = new();

    /// <summary>پاسخ‌های عیناً تکراری</summary>
    public List<WordFrequencyDto> RepeatedAnswers { get; set; } = new();

    /// <summary>همه‌ی پاسخ‌ها (حداکثر ۱۰۰۰) با برچسب احساس و موضوع، برای جستجو و فیلتر در صفحه</summary>
    public List<TextAnswerItemDto> Answers { get; set; } = new();
}

public record WordFrequencyDto(string Word, int Count);

public class SentimentSummaryDto
{
    public int PositiveCount { get; set; }
    public int NegativeCount { get; set; }
    public int NeutralCount { get; set; }
    public decimal PositivePercentage { get; set; }
    public decimal NegativePercentage { get; set; }
    public decimal NeutralPercentage { get; set; }

    /// <summary>پاسخ‌هایی که هم نکته‌ی مثبت و هم منفی دارند</summary>
    public int MixedCount { get; set; }
    public decimal MixedPercentage { get; set; }

    /// <summary>میانگین امتیاز احساس (-۵ تا +۵)</summary>
    public decimal AverageScore { get; set; }

    /// <summary>شاخص خالص احساس (درصد مثبت منهای درصد منفی؛ -۱۰۰ تا +۱۰۰)</summary>
    public decimal NetSentiment { get; set; }
    public List<SentimentAnswerDto> Samples { get; set; } = new();
}

public record SentimentAnswerDto(string Text, string Sentiment);

public record KeywordDto(string Term, int Count, int DocumentCount, decimal Score);

public class TextThemeDto
{
    public string Key { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal Percentage { get; set; }
    public int PositiveCount { get; set; }
    public int NegativeCount { get; set; }
    public List<string> Samples { get; set; } = new();
}

public class TextAnswerItemDto
{
    public string Text { get; set; } = string.Empty;

    /// <summary>positive | negative | neutral | mixed | empty</summary>
    public string Sentiment { get; set; } = "neutral";
    public decimal Score { get; set; }
    public int WordCount { get; set; }
    public List<string> Themes { get; set; } = new();
    public bool IsSuggestion { get; set; }
}

/// <summary>خلاصه‌ی هر گام/معیار نظرسنجی</summary>
public class CriterionAnalyticsDto
{
    public Guid? Guid { get; set; }
    public string Title { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int QuestionCount { get; set; }
    public decimal AverageAnswerRate { get; set; }

    /// <summary>میانگین نرمال‌شده‌ی سوال‌های امتیازی (۰ تا ۱۰۰)؛ null اگر سوال امتیازی ندارد</summary>
    public decimal? AverageScorePercent { get; set; }

    /// <summary>شاخص خالص احساس پاسخ‌های متنی این گام (null اگر سوال متنی ندارد)</summary>
    public decimal? NetSentiment { get; set; }
    public List<Guid> QuestionGuids { get; set; } = new();
}
public record RankingStatDto(string ItemLabel, decimal AverageRank, int Count);