namespace MeetingManagement.Infrastructure.Query.Contracts.Category;

public class CategoryAccessCheckResultDto
{
    public bool HasAccess { get; set; }
    public string Message { get; set; }
}