using Epc.Application.Command;

namespace SurveyManagement.Application.Contracts.AccessControl;

/// <summary>
/// DTO برای تخصیص نقش به کاربر
/// </summary>
public record AssignRoleToUserDto : ICommand
{
    public Guid UserGuid { get; init; }
    public int RoleId { get; init; }
    public string? ExpirationDate { get; init; }
}
