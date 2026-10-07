namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// DTO برای Combo Box
/// </summary>
public class SurveyComboDto
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
}
