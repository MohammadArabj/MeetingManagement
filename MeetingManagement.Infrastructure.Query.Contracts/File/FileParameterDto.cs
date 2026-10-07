using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.File;

public class FileParameterDto
{
    public long ModuleId  { get; set; }
    public FileType Type { get; set; }
}