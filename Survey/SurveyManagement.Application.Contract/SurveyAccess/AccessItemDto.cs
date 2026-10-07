using SurveyManagement.Common;

namespace SurveyManagement.Application.Contract.AccessControl;

/// <summary>
/// آیتم دسترسی
/// </summary>
public record AccessItemDto
{
    public Guid? Guid { get; init; }
    public TargetType TargetType { get; init; }
    public Guid? TargetGuid { get; init; }
    public bool CanView { get; init; }
    public bool CanRespond { get; init; }
    public bool CanViewResults { get; init; }
    public bool CanEdit { get; init; }
    public bool CanDelete { get; init; }
    public string? ExpirationDate { get; init; }
    public bool IsRemoved { get; init; }
}
