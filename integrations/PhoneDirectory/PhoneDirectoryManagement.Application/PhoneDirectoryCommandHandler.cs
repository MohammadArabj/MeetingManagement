// PhoneDirectoryManagement.Application/PhoneDirectoryCommandHandler.cs
using PhoneDirectoryManagement.Application.Contracts.PhoneDirectory;
using PhoneDirectoryManagement.Common;
using PhoneDirectoryManagement.Domain.PhoneDirectoryAgg;
using PhoneDirectoryManagement.Domain.PhoneDirectoryAgg.Service;
using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;

namespace PhoneDirectoryManagement.Application;

public class PhoneDirectoryCommandHandler(
    IPhoneDirectoryRepository repository,
    IClaimHelper claimHelper,
    IPhoneDirectoryService service
) :
    ICommandHandlerAsync<CreatePhoneDirectoryEntryDto, Result<Guid>>,
    ICommandHandlerAsync<EditPhoneDirectoryEntryDto, Result<bool>>,
    ICommandHandlerAsync<DeletePhoneDirectoryEntryDto, Result<bool>>,
    ICommandHandlerAsync<ActivatePhoneDirectoryEntryDto, Result<bool>>,
    ICommandHandlerAsync<DeactivatePhoneDirectoryEntryDto, Result<bool>>
{
    public async Task<Result<Guid>> Handle(CreatePhoneDirectoryEntryDto command)
    {
        var userGuid = claimHelper.GetCurrentUserGuid();
        var type = (PhoneDirectoryEntryType)command.Type;

        var entry = new PhoneDirectoryEntry(userGuid, type, command.PositionGuid, command.LocationTitle,command.Description, service);

        foreach (var dto in command.Numbers.Where(n => !n.IsRemoved))
            entry.AddNumber(userGuid, dto.Number, dto.DisplayOrder);

        await repository.CreateAsync(entry);
        return Result<Guid>.Success(entry.Guid);
    }

    public async Task<Result<bool>> Handle(EditPhoneDirectoryEntryDto command)
    {
        var entry = await repository.LoadAsync(command.Guid, "Numbers");
        if (entry == null)
            return Result<bool>.Failure(false, "مخاطب یافت نشد.");

        var userGuid = claimHelper.GetCurrentUserGuid();
        var type = (PhoneDirectoryEntryType)command.Type;

        // ✅ حالا نوع مخاطب (سمت ⇄ مکان) هم در ویرایش قابل تغییر است.
        // خود متد Edit مسئول پاک‌کردن فیلد نوع قبلی (PositionGuid یا LocationTitle) است.
        entry.Edit(userGuid, type, command.PositionGuid, command.LocationTitle,command.Description, service);

        foreach (var dto in command.Numbers)
        {
            if (dto.IsRemoved)
                entry.RemoveNumber(dto.Number);
            else
                entry.AddNumber(userGuid, dto.Number, dto.DisplayOrder);
        }

        repository.Update(entry);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(DeletePhoneDirectoryEntryDto command)
    {
        var entry = await repository.LoadAsync(command.Guid);
        if (entry == null)
            return Result<bool>.Failure(false, "مخاطب یافت نشد.");

        repository.Delete(entry);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(ActivatePhoneDirectoryEntryDto command)
    {
        var entry = await repository.LoadAsync(command.Guid);
        if (entry == null)
            return Result<bool>.Failure(false, "مخاطب یافت نشد.");

        entry.Activate();
        repository.Update(entry);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(DeactivatePhoneDirectoryEntryDto command)
    {
        var entry = await repository.LoadAsync(command.Guid);
        if (entry == null)
            return Result<bool>.Failure(false, "مخاطب یافت نشد.");

        entry.Deactivate();
        repository.Update(entry);
        return Result<bool>.Success(true);
    }
}