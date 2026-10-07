using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Question;

/// <summary>
/// DTO برای جزئیات کامل سوال (برای نمایش در فرم پاسخ‌دهی)
/// </summary>
public class QuestionDetailDto
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string QuestionText { get; set; }
    public QuestionType QuestionType { get; set; }
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }
    public string? HelpText { get; set; }
    public string? Placeholder { get; set; }
    public bool RandomizeOptions { get; set; }
    public bool AllowOtherOption { get; set; }
    public string? OtherOptionText { get; set; }
    public Guid? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    
    // Validation
    public ValidationType ValidationType { get; set; }
    public string? ValidationErrorMessage { get; set; }
    public string? CustomValidationRegex { get; set; }
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public int? MinSelections { get; set; }
    public int? MaxSelections { get; set; }
    
    // File Upload
    public int? MaxFileSize { get; set; }
    public string? AllowedFileTypes { get; set; }
    
    // Scale
    public string? MinScaleLabel { get; set; }
    public string? MaxScaleLabel { get; set; }
    
    // Matrix
    public List<string>? MatrixRows { get; set; }
    public List<string>? MatrixColumns { get; set; }
    
    // Options
    public List<QuestionOptionDetailDto> Options { get; set; } = new();
    
    // Logic (برای فرانت‌اند که بداند چه سوالاتی را نشان دهد)
    public List<QuestionLogicDetailDto> Logics { get; set; } = new();
    public Guid? CriterionGuid { get; set; }
}
