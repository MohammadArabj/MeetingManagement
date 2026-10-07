using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Member;

namespace MeetingManagement.Presentation.Facade.Contracts.Member;

public interface IMemberCommandFacade:IFacadeService
{
    Task<Result<long>> CreateOrEdit(MeetingMemberDto command);
    Task<Result<bool>> Delete(long id);
    Task<Result<bool>> SetComment(MeetingMemberCommentDto comment);
    Task<Result<bool>> CreateMember(CreateMemberDto command);
    Task<Result<bool>> SetSubstitute(SetSubstituteDto command);
    Task<Result<bool>> Attendance(AttendanceMemberDto request);
    Task<Result<bool>> SetGroupAttendance(AttendanceGroupDto request);
}