using Epc.Application.Command;

namespace SurveyManagement.Application.Contract.AccessControl;

/// <summary>
/// DTO برای تنظیم دسترسی‌های نظرسنجی
/// </summary>
public record SetSurveyAccessDto : ICommand
{
    public Guid SurveyGuid { get; init; }
    public List<AccessItemDto> AccessItems { get; init; } = new();
}
