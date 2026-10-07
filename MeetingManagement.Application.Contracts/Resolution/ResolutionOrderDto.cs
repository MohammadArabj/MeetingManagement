using Epc.Application.Command;
using System.Collections.Generic;

namespace MeetingManagement.Application.Contracts.Resolution;
public class UpdateResolutionOrderRequest:ICommand
{
    public List<ResolutionOrderDto> Resolutions { get; set; } = [];
}

public class ResolutionOrderDto:ICommand
{
    public long Id { get; set; }
    public byte SortOrder { get; set; }
}