using System.Security.Cryptography.Pkcs;
using Epc.Domain;
using MeetingManagement.Application.Contracts.Member;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.BoardMemberAgg;
using MeetingManagement.Domain.RoleAgg;
using MeetingManagement.Domain.Shared.Access;

namespace MeetingManagement.Domain.MeetingAgg;

public class MeetingMember
{
    public MeetingMember()
    {
        
    }
    public MeetingMember(Guid creator,MeetingMemberDto member,long meetingId,int? boardMemberId=null) 
    {
        Name = member.Name??"";
        UserGuid = member.UserGuid;
        RoleId = member.RoleId;
        ReplacementUserGuid = member.ReplacementUserGuid;
        MeetingId = meetingId;
        Mobile= member.Mobile;
        Email= member.Email;
        Gender = member.Gender;
        Organization= member.Organization;
        IsExternal = member.IsExternal;
        Signature = member.SignatureGuid;
        Profile = member.ProfileGuid;
        PositionGuid= member.PositionGuid;
        Created=DateTime.Now;
        CreatedBy = creator;
        PersNo=member.PersNo;
        BoardMemberId = boardMemberId;
    }

    public void Edit( MeetingMemberDto member)
    {
        Name = member.Name ?? "";
        UserGuid = member.UserGuid;
        RoleId = member.RoleId;
        ReplacementUserGuid = member.ReplacementUserGuid;
        Email = member.Email;
        Organization= member.Organization;
        Mobile = member.Mobile;
        IsExternal= member.IsExternal;
        PositionGuid=member.PositionGuid;
        if(member.Signature!=null)
            Signature = member.SignatureGuid;
        if(member.ProfileGuid!=null)
            Profile = member.ProfileGuid;
        MainRoleId = member.MainRoleId;
        PersNo=member.PersNo;
        Gender=member.Gender;
    }

    public void SetComment(MeetingMemberCommentDto member)
    {
        Comment = member.Comment ?? Comment;

        var prevSign = IsSign;
        IsSign = member.IsSign ?? IsSign;

        Signer = member.Signer;

        // NEW: ثبت تاریخ امضا
        if (prevSign != true && IsSign == true)
            SignedAt = DateTime.Now;

        // اگر امضا برداشته شد
        if (prevSign == true && IsSign != true)
            SignedAt = null;
    }

    public void SetAttendance(bool isAttendance)
    {
        IsAttendance = isAttendance;
    }
    public void SetSubstitute( bool isPresent)
    {
        IsPresent = isPresent;
    }
    public void SetReplacement(Guid? replacementUserGuid)
    {
        ReplacementUserGuid = replacementUserGuid;
    }

    public void SetMainRole()
    {
        RoleId = MainRoleId ?? MeetingRoles.MemberId;
        MainRoleId = null;
        ReplacementUserGuid = null;
    }
    public long Id { get; set; }
    public string? Name { get;private set; }
    public string? Comment { get; set; }
    public long? MeetingId { get;private set; }
    public int? BoardMemberId { get; set; }
    public string? Mobile { get;private set; }
    public string? Email { get;private set; }
    public string? Organization { get;private set; }
    public bool? IsExternal { get; private set; }
    public Gender? Gender { get; set; }
    public Guid? UserGuid { get;private set; }
    public Guid? PositionGuid { get;private set; }
    public Guid? ReplacementUserGuid { get;private set; }
    public Guid? Signer { get;private set; }
    public int? MainRoleId { get; set; }
    public bool? IsPresent { get;private set; }
    public bool? IsAttendance { get;private set; }
    public bool? IsSign { get;private set; }
    public DateTime? SignedAt { get; private set; }   // NEW
    public Guid? Profile { get; set; }
    public Guid? Signature { get; set; }
    public int? RoleId { get;private set; }
    public Guid? CreatedBy { get; set; }
    public DateTime? Created { get; set; }
    public int? IsActive { get; set; }
    public Role? Role { get;private set; }
    public Meeting? Meeting { get;private set; }
    public BoardMember? BoardMember { get; set; }
    public string? PersNo { get; set; }
}