using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// DTO نظرسنجی عمومی برای پاسخ‌دهی
/// </summary>
public class PublicSurveyDto
{
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public string? WelcomeMessage { get; set; }
    public string? ThankYouMessage { get; set; }
    public string? ThemeColor { get; set; }
    public Guid? LogoGuid { get; set; }
    public Guid? BackgroundImageGuid { get; set; }
    
    public bool AllowAnonymous { get; set; }
    public bool AllowSaveDraft { get; set; }
    public bool ShowProgressBar { get; set; }
    public bool RandomizeQuestions { get; set; }
    public bool AllowMultipleResponses { get; set; }
    public bool RequireLogin { get; set; }
    
    public int TotalQuestions { get; set; }
    public int? MaxResponses { get; set; }
    public int TotalResponses { get; set; }
    
    public string StartDate { get; set; }
    public string EndDate { get; set; }
    
    public bool IsActive { get; set; }
    public bool IsExpired { get; set; }
    public bool IsFull { get; set; }
    
    public List<PublicQuestionDto> Questions { get; set; } = new();
}

/// <summary>
/// DTO سوال برای نمایش عمومی
/// </summary>
public class PublicQuestionDto
{
    public Guid Guid { get; set; }
    public string QuestionText { get; set; }
    public QuestionType QuestionType { get; set; }
    public string QuestionTypeName { get; set; }
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }
    public string? HelpText { get; set; }
    public string? Placeholder { get; set; }
    public Guid? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    
    // Validation
    public ValidationType? ValidationType { get; set; }
    public string? ValidationErrorMessage { get; set; }
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    
    // Options
    public List<PublicOptionDto>? Options { get; set; }
    public bool RandomizeOptions { get; set; }
    public bool AllowOtherOption { get; set; }
    public string? OtherOptionText { get; set; }
    
    // Scale
    public string? MinScaleLabel { get; set; }
    public string? MaxScaleLabel { get; set; }
    
    // Matrix
    public string? MatrixRowsJson { get; set; }
    public string? MatrixColumnsJson { get; set; }
    
    // File Upload
    public int? MaxFileSize { get; set; }
    public string? AllowedFileTypes { get; set; }
}

/// <summary>
/// DTO گزینه برای نمایش عمومی
/// </summary>
public class PublicOptionDto
{
    public Guid Guid { get; set; }
    public string OptionText { get; set; }
    public int SortOrder { get; set; }
    public string? Value { get; set; }
    public Guid? ImageUrl { get; set; }
    public string? Color { get; set; }
}

/// <summary>
/// Request برای دریافت نظرسنجی عمومی
/// </summary>
public record GetPublicSurveyRequest(Guid SurveyGuid);

/// <summary>
/// DTO لینک عمومی نظرسنجی
/// </summary>
public class SurveyPublicLinkDto
{
    public Guid SurveyGuid { get; set; }
    public string Title { get; set; }
    public string PublicUrl { get; set; }
    public string QRCodeBase64 { get; set; } // تصویر QR Code به صورت Base64
    public bool IsActive { get; set; }
    public string Status { get; set; }
    public string StartDate { get; set; }
    public string EndDate { get; set; }
}

/// <summary>
/// Request برای دریافت لینک عمومی
/// </summary>
public record GetSurveyPublicLinkRequest(Guid SurveyGuid);
