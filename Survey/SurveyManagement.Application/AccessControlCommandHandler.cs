using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Common.Extensions;
using SurveyManagement.Application.Contract.AccessControl;
using SurveyManagement.Application.Contracts.AccessControl;
using SurveyManagement.Domain.SurveyAccessAgg;
using SurveyManagement.Domain.SurveyAgg;

namespace SurveyManagement.Application;

public class AccessControlCommandHandler(
    ISurveyAccessRepository accessRepository,
    ISurveySystemRoleRepository roleRepository,
    IUserSurveyRoleRepository userRoleRepository,
    ISurveyRepository surveyRepository,
    SurveyManagement.Domain.Shared.Access.ISurveyAccessService surveyAccess,
    IClaimHelper claimHelper) :
    ICommandHandlerAsync<SetSurveyAccessDto, Result<bool>>,
    ICommandHandlerAsync<RemoveSurveyAccessDto, Result<bool>>,
    ICommandHandlerAsync<AssignRoleToUserDto, Result<bool>>,
    ICommandHandlerAsync<RemoveRoleFromUserDto, Result<bool>>,
    ICommandHandlerAsync<CreateRoleDto, Result<int>>,
    ICommandHandlerAsync<EditRoleDto, Result<bool>>,
    ICommandHandlerAsync<DeleteRoleDto, Result<bool>>
{
    private async Task<bool> CanManageRolesAsync() =>
        (await surveyAccess.IdentityAsync()).HasAnyPermission([
            SurveyManagement.Common.Security.SurveyPermissions.AccessControl,
            SurveyManagement.Common.Security.SurveyPermissions.AccessControlAssignRole,
            SurveyManagement.Common.Security.SurveyPermissions.AccessControlCreateRole]);

    public async Task<Result<bool>> Handle(SetSurveyAccessDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var surveyId = await surveyRepository.GetIdByAsync(command.SurveyGuid);

        if (surveyId == 0)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");

        var survey = await surveyRepository.LoadAsync(surveyId, "AccessControls");
        if (survey == null)
            return Result<bool>.Failure(false, "نظرسنجی یافت نشد.");

        if (!((await surveyAccess.GetAsync(survey.Id))?.CanManage ?? false))
            return Result<bool>.Failure(false, "شما مجاز به تنظیم دسترسی‌های این نظرسنجی نیستید.");

        // پردازش دسترسی‌ها
        foreach (var accessDto in command.AccessItems)
        {
            if (accessDto.IsRemoved && accessDto.Guid.HasValue)
            {
                // حذف دسترسی
                var accessId = await accessRepository.GetIdByAsync(accessDto.Guid.Value);
                if (accessId > 0)
                {
                    var access = survey.AccessControls.FirstOrDefault(a => a.Id == accessId);
                    if (access != null)
                    {
                        access.Deactivate(); // استفاده از متد base
                    }
                }
            }
            else if (!accessDto.IsRemoved)
            {
                DateTime? expirationDate = null;
                if (!string.IsNullOrEmpty(accessDto.ExpirationDate))
                    expirationDate = accessDto.ExpirationDate.ToDateTimeNull();

                if (accessDto.Guid.HasValue)
                {
                    // ویرایش دسترسی
                    var accessId = await accessRepository.GetIdByAsync(accessDto.Guid.Value);
                    if (accessId > 0)
                    {
                        var access = survey.AccessControls.FirstOrDefault(a => a.Id == accessId);
                        if (access != null)
                        {
                            // متد Edit: (canView, canRespond, canViewResults, canEdit, canDelete, expirationDate)
                            access.Edit(
                                accessDto.CanView,
                                accessDto.CanRespond,
                                accessDto.CanViewResults,
                                accessDto.CanEdit,
                                accessDto.CanDelete,
                                expirationDate);
                        }
                    }
                }
                else
                {
                    // افزودن دسترسی جدید
                    // سازنده: (creator, surveyId, targetType, targetGuid, canView, canRespond, canViewResults, canEdit, canDelete)
                    // توجه: expirationDate در سازنده نیست!
                    var newAccess = new SurveyAccess(
                        currentUserId,
                        surveyId,
                        accessDto.TargetType,
                        accessDto.TargetGuid,
                        accessDto.CanView,
                        accessDto.CanRespond,
                        accessDto.CanViewResults,
                        accessDto.CanEdit,
                        accessDto.CanDelete);

                    // اگر expirationDate داریم، با Edit set می‌کنیم
                    if (expirationDate.HasValue)
                    {
                        newAccess.Edit(
                            accessDto.CanView,
                            accessDto.CanRespond,
                            accessDto.CanViewResults,
                            accessDto.CanEdit,
                            accessDto.CanDelete,
                            expirationDate);
                    }

                    await accessRepository.CreateAsync(newAccess);
                }
            }
        }

        await accessRepository.SaveChangesAsync();
        return Result<bool>.Success(true, "دسترسی‌ها با موفقیت تنظیم شدند.");
    }

    public async Task<Result<bool>> Handle(RemoveSurveyAccessDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();
        var accessId = await accessRepository.GetIdByAsync(command.Guid);

        if (accessId == 0)
            return Result<bool>.Failure(false, "دسترسی یافت نشد.");

        var access = await accessRepository.LoadAsync(accessId, "Survey");
        if (access == null)
            return Result<bool>.Failure(false, "دسترسی یافت نشد.");

        if (!((await surveyAccess.GetAsync(access.SurveyId))?.CanManage ?? false))
            return Result<bool>.Failure(false, "شما مجاز به حذف این دسترسی نیستید.");

        access.Deactivate();
        accessRepository.Update(access);
        await accessRepository.SaveChangesAsync();

        return Result<bool>.Success(true, "دسترسی با موفقیت حذف شد.");
    }

    public async Task<Result<bool>> Handle(AssignRoleToUserDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();

        // نقش‌های سامانه برای همه‌ی نظرسنجی‌ها اعمال می‌شوند؛ فقط مدیر سامانه یا دارنده‌ی مجوز مربوط
        if (!await CanManageRolesAsync())
            return Result<bool>.Failure(false, "شما مجاز به مدیریت نقش‌های سامانه نظرسنجی نیستید.");

        // بررسی نقش
        var role = await roleRepository.LoadAsync(command.RoleId);
        if (role == null)
            return Result<bool>.Failure(false, "نقش یافت نشد.");

        // بررسی تکراری
        var exists = await userRoleRepository.ExistsAsync(
            x => x.UserGuid == command.UserGuid && x.RoleId == command.RoleId);

        if (exists)
            return Result<bool>.Failure(false, "این نقش قبلاً به کاربر تخصیص داده شده است.");

        DateTime? expirationDate = null;
        if (!string.IsNullOrEmpty(command.ExpirationDate))
            expirationDate = command.ExpirationDate.ToDateTimeNull();

        // سازنده: (creator, userGuid, roleId) - فقط 3 پارامتر!
        var userRole = new UserSurveyRole(
            currentUserId,
            command.UserGuid,
            command.RoleId);

        // set کردن expirationDate با متد جداگانه
        if (expirationDate.HasValue)
            userRole.SetExpirationDate(expirationDate);

        await userRoleRepository.CreateAsync(userRole);
        await userRoleRepository.SaveChangesAsync();

        return Result<bool>.Success(true, "نقش با موفقیت به کاربر تخصیص داده شد.");
    }

    public async Task<Result<bool>> Handle(RemoveRoleFromUserDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();

        // نقش‌های سامانه برای همه‌ی نظرسنجی‌ها اعمال می‌شوند؛ فقط مدیر سامانه یا دارنده‌ی مجوز مربوط
        if (!await CanManageRolesAsync())
            return Result<bool>.Failure(false, "شما مجاز به مدیریت نقش‌های سامانه نظرسنجی نیستید.");

        var userRoleId = await userRoleRepository.GetIdByAsync(command.Guid);
        if (userRoleId == 0)
            return Result<bool>.Failure(false, "تخصیص نقش یافت نشد.");

        var userRole = await userRoleRepository.LoadAsync(userRoleId);
        if (userRole == null)
            return Result<bool>.Failure(false, "تخصیص نقش یافت نشد.");

        userRoleRepository.Delete(userRole);
        await userRoleRepository.SaveChangesAsync();

        return Result<bool>.Success(true, "نقش با موفقیت از کاربر حذف شد.");
    }

    public async Task<Result<int>> Handle(CreateRoleDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();

        // نقش‌های سامانه برای همه‌ی نظرسنجی‌ها اعمال می‌شوند؛ فقط مدیر سامانه یا دارنده‌ی مجوز مربوط
        if (!await CanManageRolesAsync())
            return Result<int>.Failure(0, "شما مجاز به مدیریت نقش‌های سامانه نظرسنجی نیستید.");

        // بررسی تکراری بودن نام
        var exists = await roleRepository.ExistsAsync(x => x.RoleName == command.RoleName);
        if (exists)
            return Result<int>.Failure(0, "نقش با این نام قبلاً ثبت شده است.");

        // سازنده: (creator, roleName, description, roleType) - فقط 4 پارامتر! isSystemRole نیست
        var role = new SurveySystemRole(
            currentUserId,
            command.RoleName,
            command.Description,
            command.RoleType);

        // نقش کاربری است (نه سیستمی)، پس IsSystemRole = false که مقدار پیش‌فرض است

        await roleRepository.CreateAsync(role);
        await roleRepository.SaveChangesAsync();

        return Result<int>.Success(role.Id, "نقش با موفقیت ایجاد شد.");
    }

    public async Task<Result<bool>> Handle(EditRoleDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();

        // نقش‌های سامانه برای همه‌ی نظرسنجی‌ها اعمال می‌شوند؛ فقط مدیر سامانه یا دارنده‌ی مجوز مربوط
        if (!await CanManageRolesAsync())
            return Result<bool>.Failure(false, "شما مجاز به مدیریت نقش‌های سامانه نظرسنجی نیستید.");

        var role = await roleRepository.LoadAsync(command.Id);
        if (role == null)
            return Result<bool>.Failure(false, "نقش یافت نشد.");

        // نقش‌های سیستمی قابل ویرایش نیستند
        if (role.IsSystemRole)
            return Result<bool>.Failure(false, "نقش‌های سیستمی قابل ویرایش نیستند.");

        // بررسی تکراری بودن نام
        var exists = await roleRepository.ExistsAsync(
            x => x.RoleName == command.RoleName && x.Id != command.Id);
        if (exists)
            return Result<bool>.Failure(false, "نقش با این نام قبلاً ثبت شده است.");

        // متد Edit: (roleName, description)
        role.Edit(command.RoleName, command.Description);
        roleRepository.Update(role);
        await roleRepository.SaveChangesAsync();

        return Result<bool>.Success(true, "نقش با موفقیت ویرایش شد.");
    }

    public async Task<Result<bool>> Handle(DeleteRoleDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();

        // نقش‌های سامانه برای همه‌ی نظرسنجی‌ها اعمال می‌شوند؛ فقط مدیر سامانه یا دارنده‌ی مجوز مربوط
        if (!await CanManageRolesAsync())
            return Result<bool>.Failure(false, "شما مجاز به مدیریت نقش‌های سامانه نظرسنجی نیستید.");

        var role = await roleRepository.LoadAsync(command.Id);
        if (role == null)
            return Result<bool>.Failure(false, "نقش یافت نشد.");

        // نقش‌های سیستمی قابل حذف نیستند
        if (role.IsSystemRole)
            return Result<bool>.Failure(false, "نقش‌های سیستمی قابل حذف نیستند.");

        // بررسی اینکه آیا نقش به کاربری تخصیص داده شده
        var hasUsers = await userRoleRepository.ExistsAsync(x => x.RoleId == command.Id);
        if (hasUsers)
            return Result<bool>.Failure(false, "این نقش به برخی کاربران تخصیص داده شده و قابل حذف نیست.");

        roleRepository.Delete(role);
        await roleRepository.SaveChangesAsync();

        return Result<bool>.Success(true, "نقش با موفقیت حذف شد.");
    }
}