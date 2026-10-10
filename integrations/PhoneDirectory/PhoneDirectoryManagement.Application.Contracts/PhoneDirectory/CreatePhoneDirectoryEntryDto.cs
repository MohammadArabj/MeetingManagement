// PhoneDirectoryManagement.Application/Contracts/PhoneDirectory/Dtos.cs
using Epc.Application.Command;

namespace PhoneDirectoryManagement.Application.Contracts.PhoneDirectory;

public class CreatePhoneDirectoryEntryDto:ICommand
{
    public int Type { get; set; }                 // 1 = Position, 2 = Location
    public Guid? PositionGuid { get; set; }
    public string? LocationTitle { get; set; }
    public List<PhoneDirectoryNumberDto> Numbers { get; set; } = [];
    public string? Description { get; set; }
}
