using Epc.Application.Command;

namespace SurveyManagement.Application.Contract.AccessControl;

/// <summary>
/// DTO برای ویرایش نقش
/// </summary>
public record EditRoleDto : ICommand
{
    public int Id { get; init; }
    public string RoleName { get; init; }
    public string? Description { get; init; }
}
