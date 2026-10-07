using System;
using System.Collections.Generic;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Presentation.Facade.Contracts.Assignment;
using System.Threading.Tasks;
using MeetingManagement.Infrastructure.Query.Contracts.Assignment;

namespace MeetingManagement.Presentation.Facade.Query;

public class AssignmentQueryFacade(IQueryBusAsync queryBusAsync):IAssignmentQueryFacade
{
    public async Task<Result<AssignmentDto>> GetAssignment(AssignmentSearchWitPositionDto condition) => await queryBusAsync.Dispatch<Result<AssignmentDto>, AssignmentSearchWitPositionDto>(condition);

    public async Task<Result<List<AssignmentListDto>>> GetList(AssignmentSearchDto search) =>
        await queryBusAsync.Dispatch<Result<List<AssignmentListDto>>, AssignmentSearchDto>(search);

    public async Task<Result<AssignmentCountDto>> GetCounts(Guid userGuid) =>
        await queryBusAsync.Dispatch<Result<AssignmentCountDto>, Guid>(userGuid);

    public async Task<Result<AssignmentResolutionDetails>> GetAssignmentResolutionDetails(int id) =>
        await queryBusAsync.Dispatch<Result<AssignmentResolutionDetails>, int> (id);

    public async Task<Result<List<AssignmentReferralListDto>>> GetReferrals(int assignmentId) =>
        await queryBusAsync.Dispatch<Result<List<AssignmentReferralListDto>>, int>(assignmentId);
    public async Task<Result<AssignmentTreeDto>> GetAssignmentTree(int assignmentId) =>
        await queryBusAsync.Dispatch<Result<AssignmentTreeDto>, int>(assignmentId);


    public async Task<Result<List<AssignmentListDto>>> GetMyReferrals(Guid userGuid) =>
        await queryBusAsync.Dispatch<Result<List<AssignmentListDto>>, Guid>(userGuid);
    public async Task<Result<List<AssignmentListDto>>> GetReferralsGivenByMe(Guid userGuid) =>
        await queryBusAsync.Dispatch<Result<List<AssignmentListDto>>, AssignmentListGuidDto>(new AssignmentListGuidDto(userGuid));

    public async Task<Result<OriginalAssignmentCountsDto>> GetOriginalAssignmentCounts(Guid positionGuid) =>
        await queryBusAsync.Dispatch<Result<OriginalAssignmentCountsDto>, Guid>(positionGuid);

    public async Task<Result<ReferralCountsDto>> GetReceivedReferralCounts(Guid positionGuid) =>
        await queryBusAsync.Dispatch<Result<ReferralCountsDto>, AssignmentListGuidDto>(new AssignmentListGuidDto(positionGuid));

    public async Task<Result<ReferralCountsDto>> GetSentReferralCounts(Guid positionGuid) =>
        await queryBusAsync.Dispatch<Result<ReferralCountsDto>, Guid>(positionGuid);

    public async Task<Result<PendingActionCountsDto>> GetPendingActionCounts(Guid positionGuid) =>
        await queryBusAsync.Dispatch<Result<PendingActionCountsDto>, Guid>(positionGuid);

    public async Task<Result<FollowerActorsActionCountsDto>> GetFollowerActorsActionCounts(Guid positionGuid)=>
    await queryBusAsync.Dispatch<Result<FollowerActorsActionCountsDto>, AssignmentGuid>(new AssignmentGuid(positionGuid));

    public async Task<Result<List<AssignmentActorDto>>> GetBoardActors() =>
        await queryBusAsync.Dispatch<Result<List<AssignmentActorDto>>>();
}