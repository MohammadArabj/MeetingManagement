namespace SurveyManagement.Infrastructure.Query.Contract.Question;

/// <summary>
/// آمار هر گزینه
/// </summary>
public class OptionStatDto
{
    public long OptionId { get; set; }
    public string OptionText { get; set; }
    public int Count { get; set; }
    public decimal Percentage { get; set; }
}
