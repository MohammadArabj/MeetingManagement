namespace SurveyManagement.Infrastructure.Query.Contract.Question;

/// <summary>
/// DTO برای گزینه‌های سوال
/// </summary>
public class QuestionOptionDetailDto
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string OptionText { get; set; }
    public int SortOrder { get; set; }
    public string? Value { get; set; }
    public Guid? ImageUrl { get; set; }
    public string? Color { get; set; }
}
