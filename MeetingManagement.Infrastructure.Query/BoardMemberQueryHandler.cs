using MeetingManagement.Common.Security;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;
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

/// <summary>
/// اعضای هیئت مدیره (اطلاعات تماس و تصویر). خواندن فقط برای دارندگان دسترسی «اعضای هیئت مدیره» یا
/// «مشاهده جلسات هیئت مدیره»، یا سمتی که مجوز ثبت جلسه در دسته‌بندی هیئت مدیره را دارد (دبیرخانه).
/// </summary>
public class BoardMemberQueryHandler(MeetingManagementQueryContext context, IActingIdentityResolver identityResolver)
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
        if (!await CanReadAsync())
            return Result<List<BoardMemberDto>>.Failure([], DeniedMessage);

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
        if (!await CanReadAsync())
            return Result<List<BoardMemberListDto>>.Failure([], DeniedMessage);

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

    private const string DeniedMessage = "شما به اطلاعات اعضای هیئت مدیره دسترسی ندارید.";

    private async Task<bool> CanReadAsync()
    {
        var identity = await identityResolver.ResolveAsync();
        if (identity.HasExplicitPermission(Permissions.BoardMembers) || identity.HasExplicitPermission(Permissions.BoardViewAll))
            return true;

        var position = identity.PositionGuid;
        var boardGuid = SettingValues.BoardCategoryGuid;
        return position is not null && await context.CategoryPermissions.AsNoTracking()
            .AnyAsync(cp => cp.PositionGuid == position && cp.Category.Guid == boardGuid);
    }
}
