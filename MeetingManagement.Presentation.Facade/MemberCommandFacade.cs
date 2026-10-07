using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Application.Contracts.Member;
using MeetingManagement.Presentation.Facade.Contracts.Member;

namespace MeetingManagement.Presentation.Facade.Command;

public class MemberCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync,ICommandBusAsync commandBusAsync):IMemberCommandFacade
{
    public async Task<Result<long>> CreateOrEdit(MeetingMemberDto command) =>
        await responsiveCommandBusAsync.Dispatch<MeetingMemberDto, Result<long>>(command);

    public async Task<Result<bool>> Delete(long id)
     =>   await responsiveCommandBusAsync.Dispatch<DeleteMeetingMember,Result<bool>>(new DeleteMeetingMember(id));

    public async Task<Result<bool>> SetComment(MeetingMemberCommentDto comment) =>
        await responsiveCommandBusAsync.Dispatch<MeetingMemberCommentDto, Result<bool>>(comment);

    public async Task<Result<bool>> CreateMember(CreateMemberDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreateMemberDto, Result<bool>>(command);

    public async Task<Result<bool>> SetSubstitute(SetSubstituteDto command) =>
        await responsiveCommandBusAsync.Dispatch<SetSubstituteDto, Result<bool>>(command);

    public async Task<Result<bool>> Attendance(AttendanceMemberDto request)
        => await responsiveCommandBusAsync.Dispatch<AttendanceMemberDto, Result<bool>>(request);
    public async Task<Result<bool>> SetGroupAttendance(AttendanceGroupDto request)
        => await responsiveCommandBusAsync.Dispatch<AttendanceGroupDto, Result<bool>>(request);
}