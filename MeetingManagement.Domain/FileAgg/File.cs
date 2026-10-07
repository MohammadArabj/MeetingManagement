using Epc.Domain;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Common.Extensions;
using static System.Net.Mime.MediaTypeNames;

namespace MeetingManagement.Domain.FileAgg;

public class File:EntityBase<long>
{
    public File()
    {

    }
    public File(Guid creator,long moduleId, Guid fileGuid,FileType fileType) : base(creator)
    {
        FileGuid=fileGuid;
        ModuleId=moduleId;
        Type=fileType;
    }
    public Guid FileGuid { get; set; }
    public FileType Type { get; set; }
    public long ModuleId { get; set; }
}