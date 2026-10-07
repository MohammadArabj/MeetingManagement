namespace MeetingManagement.Common.Extensions;

public class UploadResult(Guid guid)
{
    public Guid Guid { get; set; } = guid;
}