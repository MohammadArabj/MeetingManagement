
using SurveyManagement.Common;
using SurveyManagement.Infrastructure.Query.Contract.Question;

namespace SurveyManagement.Infrastructure.Query.Contract.Question;

/// <summary>
/// DTO برای آمار پاسخ‌ها به یک سوال
/// </summary>
public class QuestionStatisticsDto
{
    public string QuestionText { get; set; }
    public QuestionType QuestionType { get; set; }
    public int TotalAnswers { get; set; }
    public int SkippedCount { get; set; }
    
    // برای سوالات انتخابی
    public List<OptionStatDto>? OptionStats { get; set; }
    
    // برای سوالات عددی/امتیازی
    public decimal? Average { get; set; }
    public decimal? Min { get; set; }
    public decimal? Max { get; set; }
    
    // برای سوالات متنی
    public List<string>? TextAnswers { get; set; }
    public Guid QuestionGuid { get; set; }
}
