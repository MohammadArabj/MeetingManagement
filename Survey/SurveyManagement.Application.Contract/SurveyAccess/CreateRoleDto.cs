using Epc.Application.Command;
using SurveyManagement.Common;

namespace SurveyManagement.Application.Contract.AccessControl;

/// <summary>
/// DTO برای ایجاد نقش جدید
/// </summary>
public record CreateRoleDto : ICommand
{
    public string RoleName { get; init; }
    public string? Description { get; init; }
    public SurveyRole RoleType { get; init; }
}
