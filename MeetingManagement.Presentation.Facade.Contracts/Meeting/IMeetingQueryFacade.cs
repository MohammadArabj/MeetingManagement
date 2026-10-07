using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Infrastructure.Query.Contracts.Meeting;

namespace MeetingManagement.Presentation.Facade.Contracts.Meeting;

public interface IMeetingQueryFacade:IFacadeService
{
    Task<Result<List<MeetingJsonModel>>> List(MeetingListSearchDto search);
    Task<Result<MeetingJsonModel>> GetDetails(MeetingSearchDto condition);
    Task<Result<EditMeetingDto>> GetForEdit(Guid guid);
    Task<Result<List<MeetingComboModel>>> GetForCombo();
    Task<Result<List<AgendaDto>>> GetAgendas(Guid meetingGuid);

    Task<Result<List<GuestComboDto>>> GetGuests(Guid meetingGuid);
    Task<Result<MeetingCountDto>> GetMeetingCounts(MeetingCountRequestDto request);
    Task<Result<MeetingConflictResultDto>> CheckConflicts(MeetingConflictCheckDto condition);
    Task<Result<List<TodayMeetingDto>>> GetTodayTommorrowMeetings(Guid positionGuid);
    Task<Result<CheckMeetingDto>> CheckMeeting(Guid meetingGuid);
    Task<Result<List<MeetingCalendarDto>>> GetCalendarMeetings(MeetingCalendarSearchDto condition);
    Task<Result<List<MeetingJsonModel>>> Search(MeetingSearchRequestDto request);
    Task<Result<bool>> CheckSign(Guid meetingGuid);
    Task<Result<List<MeetingStatisticResultDto>>> GetMeetingStatistic(MeetingStatisticRequestDto request);
    Task<Result<List<ComboBase>>>GetListByCategoryGuid(Guid categoryGuid);
    Task<Result<CheckMeetingNumberResultDto>> CheckMeetingNumber(CheckMeetingNumberDto condition);
    Task<Result<List<MeetingFutureDto>>> GetFutureMeetings(Guid? userGuid, Guid? positionGuid);
    Task<Result<List<SuggestedSlotDto>>> GetSuggestedSlots(SuggestedSlotsRequestDto request);
}
