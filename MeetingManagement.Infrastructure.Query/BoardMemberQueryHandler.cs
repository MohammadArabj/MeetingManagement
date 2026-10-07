using System;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.BoardMember;
using MeetingManagement.Domain.BoardMemberAgg;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.BoardMember;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query;

public class BoardMemberQueryHandler(MeetingManagementQueryContext context)
    : IQueryHandlerAsync<Result<List<BoardMemberDto>>>,
       // IQueryHandlerAsync<Result<List<BoardMemberComboModel>>>,
        IQueryHandlerAsync<Result<EditBoardMemberDto>, Guid>,
        IQueryHandlerAsync<Result<List<BoardMemberDto>>, List<Guid>>,
    IQueryHandlerAsync<Result<List<BoardMemberListDto>>>
{
    public async Task<Result<List<BoardMemberDto>>> Handle()
    {
        var result = context.BoardMembers.Select(bm => new BoardMemberDto()
        {
            Guid = bm.Guid,
            FirstName = bm.FirstName,
            LastName = bm.LastName,
            Mobile = bm.Mobile,
            ProfileImageGuid = bm.ProfileImageGuid,
            Position=bm.Position,
            Company=bm.Company,
            StartDate= bm.StartDate.HasValue ? bm.StartDate.Value.ToString("yyyy/MM/dd") : "اکنون",
            EndDate =bm.EndDate.HasValue ? bm.EndDate.Value.ToString("yyyy/MM/dd") : "اکنون",
            IsActive = bm.IsActive,
            CreatedDate = bm.Created.ToString("yyyy/MM/dd")
        }).ToList();

        return Result<List<BoardMemberDto>>.Success(result);
    }

    //public async Task<Result<List<BoardMemberComboModel>>> Handle()
    //{
    //    var activeBoardMembers = await repository.GetActiveBoardMembersAsync();
    //    var result = activeBoardMembers.Select(bm => new BoardMemberComboModel
    //    {
    //        Id = bm.Id,
    //        FullName = bm.FullName,
    //        ProfileImageGuid = bm.ProfileImageGuid
    //    }).ToList();

    //    return Result<List<BoardMemberComboModel>>.Success(result);
    //}

    public async Task<Result<EditBoardMemberDto>> Handle(Guid Guid)
    {
        var boardMember = await context.BoardMembers.FirstOrDefaultAsync(x => x.Guid == Guid);

        if (boardMember == null)
            return Result<EditBoardMemberDto>.Failure(null, "عضو هیئت مدیره یافت نشد.");

        var result = new EditBoardMemberDto
        {
            Guid = boardMember.Guid,
            FirstName = boardMember.FirstName,
            LastName = boardMember.LastName,
            Mobile = boardMember.Mobile,
            Position=boardMember.Position,
            Company = boardMember.Company,
            StartDate = boardMember.StartDate.HasValue ? boardMember.StartDate.Value.ToString("yyyy/MM/dd") : null,
            EndDate = boardMember.EndDate.HasValue? boardMember.EndDate.Value.ToString("yyyy/MM/dd"):null,
            ProfileImageGuid = boardMember.ProfileImageGuid
        };

        return Result<EditBoardMemberDto>.Success(result);
    }

    public async Task<Result<List<BoardMemberDto>>> Handle(List<Guid> condition)
    {
        var result = context.BoardMembers.Where(x=>condition.Contains(x.Guid)).Select(bm => new BoardMemberDto()
        {
            Guid = bm.Guid,
            FirstName = bm.FirstName,
            LastName = bm.LastName,
            Mobile = bm.Mobile,
            ProfileImageGuid = bm.ProfileImageGuid,
            Position = bm.Position,
            Company=bm.Company,
            StartDate = bm.StartDate.HasValue ? bm.StartDate.Value.ToString("yyyy/MM/dd") : "اکنون",
            EndDate = bm.EndDate.HasValue ? bm.EndDate.Value.ToString("yyyy/MM/dd") : "اکنون",
            IsActive = bm.IsActive,
            CreatedDate = bm.Created.ToString("yyyy/MM/dd")
        }).ToList();

        return Result<List<BoardMemberDto>>.Success(result);
    }

    async Task<Result<List<BoardMemberListDto>>> IQueryHandlerAsync<Result<List<BoardMemberListDto>>>.Handle()
    {
        var result =await context.BoardMembers.Select(bm => new BoardMemberListDto()
        {
            Guid = bm.Guid,
            FirstName = bm.FirstName,
            LastName = bm.LastName,
            Mobile = bm.Mobile,
            ProfileImageGuid = bm.ProfileImageGuid,
            Position = bm.Position,
            Company = bm.Company,
            StartDate = bm.StartDate.HasValue ? bm.StartDate.Value.ToString("yyyy/MM/dd") : "اکنون",
            EndDate = bm.EndDate.HasValue ? bm.EndDate.Value.ToString("yyyy/MM/dd") : "اکنون",
            IsActive = bm.IsActive,
            CreatedDate = bm.Created.ToString("yyyy/MM/dd")
        }).ToListAsync();

        return Result<List<BoardMemberListDto>>.Success(result);
    }
}