using System;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Label;
using MeetingManagement.Presentation.Facade.Contracts.Label;

namespace MeetingManagement.Presentation.Facade.Command;

public class LabelCommandFacade(ICommandBusAsync commandBusAsync,
    IResponsiveCommandBusAsync responsiveCommandBusAsync) : ILabelCommandFacade
{
    public async Task<Result<Guid>> Create(CreateLabelDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreateLabelDto, Result<Guid>>(command);

    public async Task<Result<bool>> Edit(EditLabelDto command) =>
        await responsiveCommandBusAsync.Dispatch<EditLabelDto, Result<bool>>(command);

    public async Task<Result<bool>> Delete(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeleteLabelDto, Result<bool>>(new DeleteLabelDto(guid));

    public async Task<Result<bool>> Activate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<ActivateLabelDto, Result<bool>>(new ActivateLabelDto(guid));

    public async Task<Result<bool>> Deactivate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeactivateLabelDto, Result<bool>>(new DeactivateLabelDto(guid));

}
