using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application.Contracts.Resolution;

public class ResolutionDto
{
    public string? Description { get; set; }
    public IFormFile? File { get; set; }
    public int LabelId { get; set; }
}