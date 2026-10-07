using Epc.Application.Command;
using SurveyManagement.Common;

namespace SurveyManagement.Application.Contract.Response;

/// <summary>
/// DTO برای پاسخ به یک سوال
/// </summary>
public record ResponseAnswerDto
{
    public Guid QuestionGuid { get; init; }
    public QuestionType QuestionType { get; init; }

    // انواع مختلف پاسخ
    public string? TextAnswer { get; init; }
    public decimal? NumericAnswer { get; init; }
    public string? DateAnswer { get; init; }
    public Guid? SelectedOptionGuid { get; init; }
    public List<Guid>? SelectedOptionGuids { get; init; }
    public string? OtherAnswer { get; init; }

    // برای فایل
    public string? FileUrl { get; init; }
    public string? FileName { get; init; }
    public long? FileSize { get; init; }

    // برای ماتریس و رتبه‌بندی
    public Dictionary<string, string>? MatrixAnswers { get; init; }
    public List<int>? RankingAnswers { get; init; }

    public int? TimeSpentSeconds { get; init; }
    public bool IsSkipped { get; init; }
}

/// <summary>
/// DTO برای حذف پاسخ (فقط پیش‌نویس)
/// </summary>
public record DeleteResponseDto(Guid Guid) : ICommand;

/// <summary>
/// DTO برای افزودن یادداشت داخلی (فقط مدیران)
/// </summary>
public record AddResponseNoteDto(Guid ResponseGuid, string Note) : ICommand;