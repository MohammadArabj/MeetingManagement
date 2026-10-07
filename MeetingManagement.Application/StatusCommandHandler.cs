using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.Status;
using MeetingManagement.Domain.MeetingStatusAgg;
using MeetingManagement.Domain.MeetingStatusAgg.Service;

namespace MeetingManagement.Application;

public class StatusCommandHandler(
    IClaimHelper claimHelper,
    IMeetingStatusRepository repository,
    IMeetingStatusService service
) : ICommandHandlerAsync<CreateStatusDto, Result<Guid>>,
    ICommandHandlerAsync<EditStatusDto, Result<bool>>
{
    public async Task<Result<Guid>> Handle(CreateStatusDto command)
    {
        var status = new MeetingStatus(claimHelper.GetCurrentUserGuid(), command.Title, command.Description, service);
        await repository.CreateAsync(status);
        return Result<Guid>.Success(status.Guid);
    }

    public async Task<Result<bool>> Handle(EditStatusDto command)
    {
        var status = await repository.LoadAsync(command.Guid);
        if (status == null)
            return Result<bool>.Failure(false, "وضعیت مورد نظر یافت نشد.");

        status.Edit(claimHelper.GetCurrentUserGuid(), command.Title, command.Description, service);
        repository.Update(status);
        return Result<bool>.Success(true);
    }
}
