using Epc.Application.Command;

namespace SurveyManagement.Application.Contract.Response;

/// <summary>
/// DTO برای شروع پاسخ‌دهی
/// </summary>
public record StartResponseDto : ICommand
{
    public Guid SurveyGuid { get; init; }
    public bool IsAnonymous { get; init; }
}
