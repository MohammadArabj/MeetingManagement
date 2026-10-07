using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Infrastructure.Query.Contracts.Assignment;

namespace MeetingManagement.Presentation.Facade.Contracts.Assignment;

public interface IAssignmentQueryFacade : IFacadeService
{
    Task<Result<AssignmentDto>> GetAssignment(AssignmentSearchWitPositionDto command);
    Task<Result<List<AssignmentListDto>>> GetList(AssignmentSearchDto search);
    Task<Result<AssignmentCountDto>> GetCounts(Guid positionGuid);
    Task<Result<AssignmentResolutionDetails>> GetAssignmentResolutionDetails(int id);

    // New referral methods
    Task<Result<List<AssignmentReferralListDto>>> GetReferrals(int assignmentId);
    Task<Result<AssignmentTreeDto>> GetAssignmentTree(int assignmentId);
    Task<Result<List<AssignmentListDto>>> GetMyReferrals(Guid userGuid);
    Task<Result<List<AssignmentListDto>>> GetReferralsGivenByMe(Guid userGuid);
    Task<Result<OriginalAssignmentCountsDto>> GetOriginalAssignmentCounts(Guid positionGuid);
    Task<Result<ReferralCountsDto>> GetReceivedReferralCounts(Guid positionGuid);
    Task<Result<ReferralCountsDto>> GetSentReferralCounts(Guid positionGuid);
    Task<Result<PendingActionCountsDto>> GetPendingActionCounts(Guid positionGuid);
    Task<Result<FollowerActorsActionCountsDto>> GetFollowerActorsActionCounts(Guid positionGuid);
    Task<Result<List<AssignmentActorDto>>> GetBoardActors();
}
