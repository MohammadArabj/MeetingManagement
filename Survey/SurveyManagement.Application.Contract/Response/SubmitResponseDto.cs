using Epc.Application.Command;

namespace SurveyManagement.Application.Contract.Response;

/// <summary>
/// DTO برای ذخیره پاسخ‌ها (پیش‌نویس یا نهایی)
/// </summary>
public record SubmitResponseDto : ICommand
{
    public Guid? ResponseGuid { get; init; }
    public Guid SurveyGuid { get; init; }
    public bool IsAnonymous { get; init; }
    public List<ResponseAnswerDto> Answers { get; init; } = new();
}
