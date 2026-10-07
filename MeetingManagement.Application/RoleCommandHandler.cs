using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.Role;
using MeetingManagement.Domain.RoleAgg;
using MeetingManagement.Domain.RoleAgg.Service;
using MeetingManagement.Domain.Shared.Access;

namespace MeetingManagement.Application;
public class RoleCommandHandler(
    IRoleRepository repository,
    IClaimHelper claimHelper,
    IRoleService service,
    IMeetingRoleConfigService roleConfigService
) : ICommandHandlerAsync<CreateRoleDto, Result<Guid>>, ICommandHandlerAsync<EditRoleDto, Result<bool>>
{
    public async Task<Result<Guid>> Handle(CreateRoleDto command)
    {
        var role = new Role(claimHelper.GetCurrentUserGuid(), command.Title, command.Color, service);
        await repository.CreateAsync(role);
        await repository.SaveChangesAsync();

        // ✅ نقش جدید بلافاصله تعریف توانایی (پیش‌فرض «سفارشی») می‌گیرد
        await roleConfigService.EnsureDefinitionAsync(role.Id);
        return Result<Guid>.Success(role.Guid);
    }

    public async Task<Result<bool>> Handle(EditRoleDto command)
    {
        var role = await repository.LoadAsync(command.Guid);
        if (role == null)
            return Result<bool>.Failure(false, "نقش مورد نظر یافت نشد.");

        role.Edit(claimHelper.GetCurrentUserGuid(), command.Title, command.Color, service);
        repository.Update(role);
        return Result<bool>.Success(true);
    }
}

