using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Infrastructure.Query.Contracts.Meeting;
using MeetingManagement.Presentation.Facade.Contracts.Meeting;

namespace MeetingManagement.Presentation.Facade.Query;

public class MeetingQueryFacade(IQueryBusAsync queryBusAsync) : IMeetingQueryFacade
{
    public async Task<Result<List<MeetingJsonModel>>> List(MeetingListSearchDto search) =>
        await queryBusAsync.Dispatch<Result<List<MeetingJsonModel>>, MeetingListSearchDto>(search);

    public async Task<Result<MeetingJsonModel>> GetDetails(MeetingSearchDto condition) =>
        await queryBusAsync.Dispatch<Result<MeetingJsonModel>, MeetingSearchDto>(condition);

    public async Task<Result<EditMeetingDto>> GetForEdit(Guid guid) =>
        await queryBusAsync.Dispatch<Result<EditMeetingDto>, Guid>(guid);

    public async Task<Result<List<MeetingComboModel>>> GetForCombo() =>
        await queryBusAsync.Dispatch<Result<List<MeetingComboModel>>>();

    public async Task<Result<List<AgendaDto>>> GetAgendas(Guid meetingGuid) =>
        await queryBusAsync.Dispatch<Result<List<AgendaDto>>, Guid>(meetingGuid);

    public async Task<Result<List<GuestComboDto>>> GetGuests(Guid meetingGuid) =>
        await queryBusAsync.Dispatch<Result<List<GuestComboDto>>, Guid>(meetingGuid);

    public async Task<Result<MeetingCountDto>> GetMeetingCounts(MeetingCountRequestDto request) =>
        await queryBusAsync.Dispatch<Result<MeetingCountDto>, MeetingCountRequestDto>(request);

    public async Task<Result<MeetingConflictResultDto>> CheckConflicts(MeetingConflictCheckDto condition) =>
        await queryBusAsync.Dispatch<Result<MeetingConflictResultDto>, MeetingConflictCheckDto>(condition);

    public async Task<Result<List<TodayMeetingDto>>> GetTodayTommorrowMeetings(Guid positionGuid) =>
        await queryBusAsync.Dispatch<Result<List<TodayMeetingDto>>, Guid>(positionGuid);

    public async Task<Result<CheckMeetingDto>> CheckMeeting(Guid meetingGuid) =>
        await queryBusAsync.Dispatch<Result<CheckMeetingDto>, Guid>(meetingGuid);

    public async Task<Result<List<MeetingCalendarDto>>> GetCalendarMeetings(MeetingCalendarSearchDto condition) =>
        await queryBusAsync.Dispatch<Result<List<MeetingCalendarDto>>, MeetingCalendarSearchDto>(condition);

    public async Task<Result<List<MeetingJsonModel>>> Search(MeetingSearchRequestDto request) =>
        await queryBusAsync.Dispatch<Result<List<MeetingJsonModel>>, MeetingSearchRequestDto>(request);

    public async Task<Result<bool>> CheckSign(Guid meetingGuid) =>
        await queryBusAsync.Dispatch<Result<bool>, CheckSignGuidDto>(new CheckSignGuidDto(meetingGuid));

    public async Task<Result<List<MeetingStatisticResultDto>>>
        GetMeetingStatistic(MeetingStatisticRequestDto request) =>
        await queryBusAsync.Dispatch<Result<List<MeetingStatisticResultDto>>, MeetingStatisticRequestDto>(request);

    public async Task<Result<List<ComboBase>>> GetListByCategoryGuid(Guid categoryGuid)
    => await queryBusAsync.Dispatch<Result<List<ComboBase>>, MeetingGuidDto>(new MeetingGuidDto(categoryGuid));

    public async Task<Result<CheckMeetingNumberResultDto>> CheckMeetingNumber(CheckMeetingNumberDto condition)
    => await queryBusAsync.Dispatch<Result<CheckMeetingNumberResultDto>, CheckMeetingNumberDto>(condition);

    public async Task<Result<List<MeetingFutureDto>>> GetFutureMeetings(Guid? userGuid, Guid? positionGuid)
    => await queryBusAsync.Dispatch<Result<List<MeetingFutureDto>>, MeetingFutureRequestDto>(new MeetingFutureRequestDto(userGuid, positionGuid));

    public async Task<Result<List<SuggestedSlotDto>>> GetSuggestedSlots(SuggestedSlotsRequestDto request)
    => await queryBusAsync.Dispatch<Result<List<SuggestedSlotDto>>, SuggestedSlotsRequestDto>(request);
}