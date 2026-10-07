using Epc.Application.Command;

namespace SurveyManagement.Application.Contract.AccessControl;

/// <summary>
/// DTO برای حذف دسترسی
/// </summary>
public record RemoveSurveyAccessDto(Guid Guid) : ICommand;

/// <summary>
/// DTO برای حذف نقش از کاربر
/// </summary>
public record RemoveRoleFromUserDto(Guid Guid) : ICommand;

/// <summary>
/// DTO برای حذف نقش
/// </summary>
public record DeleteRoleDto(int Id) : ICommand;