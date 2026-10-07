using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.Label;
using MeetingManagement.Domain.LabelAgg;
using MeetingManagement.Domain.LabelAgg.Service;

namespace MeetingManagement.Application;

public class LabelCommandHandler(
    IClaimHelper claimHelper,
    ILabelRepository repository,
    ILabelService service
) : ICommandHandlerAsync<CreateLabelDto, Result<Guid>>,
    ICommandHandlerAsync<EditLabelDto, Result<bool>>,
    ICommandHandlerAsync<DeleteLabelDto, Result<bool>>,
    ICommandHandlerAsync<ActivateLabelDto, Result<bool>>,
    ICommandHandlerAsync<DeactivateLabelDto, Result<bool>>
{
    public async Task<Result<Guid>> Handle(CreateLabelDto command)
    {
        var label = new Label(
            claimHelper.GetCurrentUserGuid(),
            command.Title,
            command.Color,
            service
        );

        await repository.CreateAsync(label);
        return Result<Guid>.Success(label.Guid);
    }

    public async Task<Result<bool>> Handle(EditLabelDto command)
    {
        var label = await repository.LoadAsync(command.Guid);
        if (label == null)
            return Result<bool>.Failure(false,"برچسب مورد نظر یافت نشد.");

        label.Edit(
            claimHelper.GetCurrentUserGuid(),
            command.Title,
            command.Color,
            service
        );

        repository.Update(label);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(DeleteLabelDto command)
    {
        var label = await repository.LoadAsync(command.Guid);
        if (label == null)
            return Result<bool>.Failure(false, "برچسب مورد نظر یافت نشد.");
        if (await service.HasHistoryAsync(label.Id))
            return Result<bool>.Failure(false, "به دلیل وجود سابقه امکان حذف وجود ندارد");
        repository.Delete(label);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(ActivateLabelDto command)
    {
        var label = await repository.LoadAsync(command.Guid);
        if (label == null)
            return Result<bool>.Failure(false, "برچسب مورد نظر یافت نشد.");

        label.Activate();
        repository.Update(label);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(DeactivateLabelDto command)
    {
        var label = await repository.LoadAsync(command.Guid);
        if (label == null)
            return Result<bool>.Failure(false, "برچسب مورد نظر یافت نشد.");

        label.Deactivate();
        repository.Update(label);
        return Result<bool>.Success(true);
    }
}
