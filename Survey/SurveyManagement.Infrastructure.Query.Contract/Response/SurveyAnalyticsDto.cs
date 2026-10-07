// SurveyManagement.Infrastructure.Query.Contract.Response/SurveyAnalyticsDto.cs

namespace SurveyManagement.Infrastructure.Query.Contract.Response;
public record GetSurveyAnalyticsRequest(Guid SurveyGuid);

public class SurveyAnalyticsDto
{
    public Guid SurveyGuid { get; set; }
    public string SurveyTitle { get; set; } = string.Empty;
    public OverviewStatsDto Overview { get; set; } = new();
    public List<QuestionAnalyticsDto> Questions { get; set; } = new();
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
    public List<SentimentAnswerDto> Samples { get; set; } = new();
}

public record SentimentAnswerDto(string Text, string Sentiment);
public record RankingStatDto(string ItemLabel, decimal AverageRank, int Count);