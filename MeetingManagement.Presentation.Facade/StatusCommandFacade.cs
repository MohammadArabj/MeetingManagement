using System;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Status;
using MeetingManagement.Presentation.Facade.Contracts.Status;

namespace MeetingManagement.Presentation.Facade.Command;

public class StatusCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync,ICommandBusAsync commandBusAsync):IStatusCommandFacade
{
    public async Task<Result<Guid>> Create(CreateStatusDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreateStatusDto, Result<Guid>>(command);

    public async Task<Result<bool>> Edit(EditStatusDto command) =>
        await responsiveCommandBusAsync.Dispatch<EditStatusDto, Result<bool>>(command);

}