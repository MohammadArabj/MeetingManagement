using Epc.Application;
using Epc.Domain;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.LabelAgg;
using MeetingManagement.Domain.MeetingAgg;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Domain.ResolutionAgg;
public class Resolution 
{
    public Resolution()
    {

    }
    public Resolution(Guid creator, string text, long meetingId,byte sortOrder, Guid? fileGuid = null, string? fileName = null)
    {
        Text = text;
        FileGuid = fileGuid;
        FileName = fileName;
        MeetingId = meetingId;
        //LabelId = labelId;
        SortOrder = sortOrder;
        Created=DateTime.Now;
        CreatedBy = creator;
    }

    public Resolution(Guid creator, string title,string number,byte sortOrder, long meetingId, string? description=null,string? decisionsMade=null, string? documentation=null,
        string? contractNumber= null, double? approvedPrice=null, long? parentMeetingId=null, long? parentResolutionId=null,
        long? committeeMeetingId=null, long? committeeResolutionId=null)
    {
        Title=title;
        Number=number;
        SortOrder=sortOrder;
        Text =description;
        Documentation=documentation;
        ContractNumber=contractNumber;
        ApprovedPrice=approvedPrice;
        ParentMeetingId = parentMeetingId;
        ParentResolutionId = parentResolutionId;
        CommitteeMeetingId = committeeMeetingId;
        CommitteeResolutionId = committeeResolutionId;
        MeetingId = meetingId;
        Created = DateTime.Now;
        CreatedBy = creator;
        DecisionsMade = decisionsMade;
    }
    public void Edit(string text ,long meetingId, Guid? fileGuid = null, string? fileName = null)
    {
        Text = text;
        MeetingId = meetingId;
        FileGuid = fileGuid;
        FileName = fileName;
        //LabelId = labelId;
    }
    public void AddAssignment(Guid? actorGuid, Guid? followerGuid, Guid? actorPositionGuid, Guid? followerPositionGuid, AssignmentType type, string dueDate, long resolutionId)
    {
        AssignedMembers.Add(new Assignment(actorGuid, followerGuid, actorPositionGuid, followerPositionGuid, type, dueDate, resolutionId));
    }

    public void EditBoardResolution(string title, string? description = null,string? decisionsMade=null, string? documentation = null,
        string? contractNumber = null, double? approvedPrice = null, long? parentMeetingId = null, long? parentResolutionId = null,
        long? committeeMeetingId = null, long? committeeResolutionId = null)
    {
        Title = title;
        // ✅ FIX: در ثبت، شرح در ستون Text ذخیره می‌شود و UI هم Text را می‌خواند؛
        // قبلاً ویرایش فقط Description را عوض می‌کرد و تغییرات «گم» می‌شد.
        Text = description;
        Description = description;
        Documentation = documentation;
        ContractNumber = contractNumber;
        ApprovedPrice = approvedPrice;
        ParentMeetingId = parentMeetingId;
        ParentResolutionId = parentResolutionId;
        CommitteeMeetingId = committeeMeetingId;
        DecisionsMade = decisionsMade;
        CommitteeResolutionId = committeeResolutionId;
    }
    public void ChangeStatus(ResolutionStatus status)
    {
        Status = status;
    }

    public void RemoveAssignedMember(Assignment assignment)
    {
        AssignedMembers.Remove(assignment);
    }

    /// <summary>حذف امن تخصیص: فقط اگر اقدام/ارجاع/نتیجه نداشته باشد.</summary>
    public bool TryRemoveAssignment(int assignmentId, out string? reason)
    {
        var assignment = AssignedMembers.FirstOrDefault(a => a.Id == assignmentId);
        if (assignment is null)
        {
            reason = null;
            return true;
        }

        if (!assignment.CanBeDeleted(out reason))
            return false;

        AssignedMembers.Remove(assignment);
        return true;
    }

    /// <summary>ترتیب بعدی (ستون از نوع tinyint است؛ سقف ۲۵۵ مصوبه در هر جلسه).</summary>
    public static byte NextSortOrder(IEnumerable<byte?> existing)
    {
        var max = existing.Where(x => x.HasValue).Select(x => (int)x!.Value).DefaultIfEmpty(0).Max();
        if (max >= byte.MaxValue)
            throw new InvalidOperationException("تعداد مصوبات این جلسه به سقف مجاز رسیده است.");
        return (byte)(max + 1);
    }

    /// <summary>شماره بعدی مصوبه هیئت مدیره: بیشینه‌ی شماره‌های عددی + ۱ (شماره‌های غیرعددی نادیده گرفته می‌شوند).</summary>
    public static string NextBoardNumber(IEnumerable<string?> existingNumbers)
    {
        var max = existingNumbers
            .Select(n => int.TryParse(n, out var v) ? v : 0)
            .DefaultIfEmpty(0)
            .Max();
        return (max + 1).ToString("D2");
    }

    public long Id { get; set; }
    public string? Text { get;  set; }
    public string? FileName { get; private set; }
    public string? Number { get; set; }
    public ResolutionStatus? Status { get; private set; }  // 
    public Guid? FileGuid { get; private set; }
    public string? Title { get;private set; }
    public string? DecisionsMade { get;private set; }
    public string? Description { get;private set; }
    public string? Documentation { get;private set; }
    public string? ContractNumber { get;private set; }
    public double? ApprovedPrice { get; private set; }
    public long? ParentMeetingId { get; private set; }
    public long? ParentResolutionId { get; private set; }
    public long? CommitteeMeetingId { get; private set; }
    public long? CommitteeResolutionId { get; private set; }
    public int? LabelId { get; private set; }
    public byte? SortOrder { get; set; }
    public Guid? CreatedBy { get; private set; }
    public DateTime? Created { get; private set; }
    public int? IsActive { get; private set; }
    public Label Label { get; private set; }
    public long MeetingId { get; private set; }
    public Meeting Meeting { get; private set; }
    public List<Assignment> AssignedMembers { get; private set; } = [];

  
}