using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Infrastructure.Acl;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Meeting;
using MeetingManagement.Infrastructure.Query.Contracts.Member;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Query;

public class MemberQueryHandler(MeetingManagementQueryContext context, IUserManagementAclService userManagementAclService) : 
    IQueryHandlerAsync<Result<List<MeetingMemberListDto>>, MemberSearchDto>,
    IQueryHandlerAsync<Result<MeetingMemberSignatureDetailsDto>,MeetingMemberSearchDto>
{
    public async Task<Result<List<MeetingMemberListDto>>> Handle(MemberSearchDto condition)
    {
        var members = await context.MeetingsMembers
             .Where(c => c.Meeting.Guid == condition.MeetingGuid)
             .Include(c=>c.Role)
             .Select(c => new
             {
                 c.Id,
                 c.UserGuid,
                 c.Name,
                 c.ReplacementUserGuid,
                 c.Email,
                 c.Mobile,
                 c.Organization,
                 c.IsExternal,
                 c.RoleId,
                 Role=c.Role.Title,
                 c.IsSign,
                 c.IsPresent,
                 c.Gender,
                 c.Comment,
                 RoleColor=c.Role.Color,
                 c.PositionGuid,
                 c.Profile,
                 c.IsAttendance,
                 c.Signature,
                 ProfileImageGuid=c.BoardMemberId!=null? c.BoardMember.ProfileImageGuid:null,
                 BoardMemberGuid= c.BoardMemberId != null ?(Guid?) c.BoardMember.Guid:null,
                 c.Signer,
             }).ToListAsync();
        var userGuids = members
            .SelectMany(m => new[] { m.UserGuid,m.Signer })
            .Where(g => g.HasValue)
            .Distinct()
            .ToList();
        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var usersDict = users.ToDictionary(u => u.Guid, u => u.Fullname);
        var memberModels = members.Select(m =>
        {
            var userName = m.UserGuid != null
                ? (usersDict.TryGetValue(m.UserGuid.Value, out var name) ? name : m.Name)
                : m.Name;
            var signer=m.Signer!= null ? (usersDict.TryGetValue(m.Signer.Value, out var signerName) ? signerName : m.Name)
                : m.Name;
            var personalNo =m.UserGuid!=null? users.FirstOrDefault(c => c.Guid == m.UserGuid)?.UserName??"0000":"00000";
            var signerPersonalNo = m.Signer != null ? users.FirstOrDefault(x => x.Guid == m.Signer)?.UserName??"0000" : "0000";
            return new MeetingMemberListDto
            {
                Id = m.Id,
                UserGuid = m.UserGuid,
                BoardMemberGuid = m.BoardMemberGuid,
                Name = userName,
                ReplacementUserGuid = m.ReplacementUserGuid,
                Email = m.Email,
                Mobile = m.Mobile,
                Organization = m.Organization,
                IsExternal = m.IsExternal??false,
                RoleId = m.RoleId ?? 0,
                Role = m.Role,
                IsPresent = m.IsPresent,
                IsAttendance = m.IsAttendance,
                IsSign = m.IsSign??false,
                IsRemoved=false,
                Comment = m.Comment,
                PositionGuid=m.PositionGuid,
                RoleColor = m.RoleColor,
                UserName=personalNo,
                ProfileGuid =m.BoardMemberGuid!=null?m.ProfileImageGuid: m.Profile,
                SignatureGuid = m.Signature,
                Signer=m.Signer,
                SignerName=signer,
                Gender=m.Gender!=null?m.Gender.ToString():"",
                SignerUserName =signerPersonalNo
            };
        }).ToList();
        return Result<List<MeetingMemberListDto>>.EmptyMessage(memberModels);
    }


    public async Task<Result<MeetingMemberSignatureDetailsDto>> Handle(MeetingMemberSearchDto condition)
    {
        var member = await context.MeetingsMembers
            .FirstOrDefaultAsync(c => c.Meeting.Guid == condition.MeetingGuid && c.UserGuid == condition.UserGuid);
        if (member == null) return Result<MeetingMemberSignatureDetailsDto>.Failure(null,"عضو مورد نظر یافت نشد");
        var result = new MeetingMemberSignatureDetailsDto()
        {
            Comment = member.Comment,
            Id = member.Id,
            Sign = member.IsSign ?? false
        };
        return Result<MeetingMemberSignatureDetailsDto>.EmptyMessage(result);
    }
}