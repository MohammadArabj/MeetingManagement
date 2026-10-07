namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// DTO برای تاریخچه تغییرات
/// </summary>
public class SurveyChangeLogDto
{
    public long Id { get; set; }
    public string ChangeType { get; set; }
    public string? Description { get; set; }
    public int Version { get; set; }
    public string ChangeDate { get; set; }
    public string ChangedBy { get; set; }
}
