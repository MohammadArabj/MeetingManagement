using System;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Infrastructure.Query.Contracts.Meeting;

namespace MeetingManagement.Presentation.Facade.Contracts.Meeting;

public interface IMeetingCommandFacade:IFacadeService
{
    Task<Result<CreateMeetingResultDto>> Create(CreateMeetingDto command);
    Task<Result<bool>> Edit(EditMeetingDto command);
    Task<Result<bool>> Delete(Guid guid);
    Task<Result<bool>> UpdateDescription(MeetingDescriptionEditModel command);
    Task<Result<bool>> ChangeStatus(ChangeStatusModel command);

    Task<Result<bool>> EditAgenda(CreateOrEditAgendaModel command);
    Task<Result<bool>> DeleteAgenda(Guid guid);
    Task<Result<bool>> UploadFiles(MeetingAttachmentDto attachment);
    Task<Result<UpdateRiderResultDto>> UpdateRider(MeetingRiderDto command);
    Task<Result<bool>> DeleteRiderFile(Guid meetingGuid);
}