using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.CategoryPermission;
using MeetingManagement.Domain.CategoryAgg;

namespace MeetingManagement.Application;



public class CategoryPermissionCommandHandler(
    ICategoryPermissionRepository repository,
    IClaimHelper claimHelper)
    : ICommandHandlerAsync<SetCategoryPermissionDto, Result<bool>>
{
    public async Task<Result<bool>> Handle(SetCategoryPermissionDto command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();
        var existingPermissions = await repository.GetByCategoryAsync(command.CategoryId);

        // حذف دسترسی‌های قبلی
        foreach (var existing in existingPermissions)
        {
            repository.Delete(existing);
        }

        // اضافه کردن دسترسی‌های جدید
        foreach (var permission in command.PositionGuids)
        {
            var categoryPermission = new CategoryPermission(
                currentUser,
                command.CategoryId,
                permission
                );
            await repository.CreateAsync(categoryPermission);
        }

        return Result<bool>.Success(true);
    }
}
