using System;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Core.Events;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Infrastructure.Query.Contracts.Meeting;
using MeetingManagement.Presentation.Facade.Contracts.Meeting;

namespace MeetingManagement.Presentation.Facade.Command;

public class MeetingCommandFacade(
    ICommandBusAsync commandBusAsync,
    IResponsiveCommandBusAsync responsiveCommandBusAsync,
    IEventAggregator eventAggregator)
    : IMeetingCommandFacade
{
    public async Task<Result<CreateMeetingResultDto>> Create(CreateMeetingDto command) => await responsiveCommandBusAsync.Dispatch<CreateMeetingDto, Result<CreateMeetingResultDto>>(command);

    public async Task<Result<bool>> Edit(EditMeetingDto command)=> await responsiveCommandBusAsync.Dispatch<EditMeetingDto,Result<bool>>(command);

    public async Task<Result<bool>> Delete(Guid guid)=>await responsiveCommandBusAsync.Dispatch<DeleteMeetingDto,Result<bool>>(new DeleteMeetingDto(guid));


    public async Task<Result<bool>> UpdateDescription(MeetingDescriptionEditModel command)=>await responsiveCommandBusAsync.Dispatch<MeetingDescriptionEditModel, Result<bool>>(command);

    public async Task<Result<bool>> ChangeStatus(ChangeStatusModel command)=>await responsiveCommandBusAsync.Dispatch<ChangeStatusModel,Result<bool>>(command);
    public async Task<Result<bool>> EditAgenda(CreateOrEditAgendaModel command)=>await responsiveCommandBusAsync.Dispatch<CreateOrEditAgendaModel,Result<bool>>(command);

    public async Task<Result<bool>> DeleteAgenda(Guid guid)=>await responsiveCommandBusAsync.Dispatch<DeleteAgendaDto,Result<bool>>(new DeleteAgendaDto(guid));

    public async Task<Result<bool>> UploadFiles(MeetingAttachmentDto attachment) =>
        await responsiveCommandBusAsync.Dispatch<MeetingAttachmentDto, Result<bool>>(attachment);
    public async Task<Result<UpdateRiderResultDto>> UpdateRider(MeetingRiderDto command) =>
        await responsiveCommandBusAsync.Dispatch<MeetingRiderDto, Result<UpdateRiderResultDto>>(command);

    public async Task<Result<bool>> DeleteRiderFile(Guid meetingGuid)
        => await responsiveCommandBusAsync.Dispatch<DeleteRiderFileGuid,Result<bool>>(new DeleteRiderFileGuid(meetingGuid));
}