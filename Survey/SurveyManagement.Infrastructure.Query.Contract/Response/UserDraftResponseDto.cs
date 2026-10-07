
namespace SurveyManagement.Infrastructure.Query.Contract.Response;

/// <summary>
/// DTO برای دریافت پیش‌نویس کاربر
/// </summary>
public class UserDraftResponseDto
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public long SurveyId { get; set; }
    public decimal? ProgressPercentage { get; set; }
    public string StartedAt { get; set; }
    public List<SavedAnswerDto> SavedAnswers { get; set; } = new();
    public Guid SurveyGuid { get; set; }
}
