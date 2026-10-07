
using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Question;

/// <summary>
/// DTO برای لیست سوالات یک نظرسنجی
/// </summary>
public class QuestionListDto
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string QuestionText { get; set; }
    public string QuestionType { get; set; }
    public QuestionType QuestionTypeEnum { get; set; }
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }
    public string? HelpText { get; set; }
    public int TotalOptions { get; set; }
    public bool HasLogic { get; set; }
}
