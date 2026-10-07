using System;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Member;

public class MeetingMemberListDto
{
    /// <summary>آدرس موقت امضاشده‌ی تصویر امضای عضو (نسبت به آدرس سامانه‌ی مدیریت فایل)؛ فقط برای مجاز‌ها</summary>
    public string? SignatureUrl { get; set; }
    /// <summary>آدرس موقت تصویر امضای امضاکننده‌ی واقعی (وقتی تفویض‌گیرنده به جای عضو امضا کرده)</summary>
    public string? SignerSignatureUrl { get; set; }

    public long Id { get; set; }
    public string Name { get; set; }
    public Guid? UserGuid { get; set; }
    public Guid? BoardMemberGuid { get; set; }
    public Guid? ReplacementUserGuid { get; set; }
    public string? Email { get; set; }
    public string? Mobile { get; set; }
    public string? Comment { get; set; }
    public string? Organization { get; set; }
    public bool IsExternal { get; set; }
    public int RoleId { get; set; }
    public string? Role { get; set; }
    public bool IsSign { get; set; }
    public bool? IsPresent { get; set; }
    public bool? IsAttendance { get; set; }
    public string? RoleColor { get; set; }
    public Guid? PositionGuid { get; set; }
    public string UserName { get; set; }
    public Guid? ProfileGuid { get; set; }
    public Guid? SignatureGuid { get; set; }
    public Guid? Signer { get; set; }
    public string? SignerName { get; set; }
    public string? SignerUserName { get; set; }
    public string? Gender { get; set; }
    public bool IsRemoved { get; set; }
}