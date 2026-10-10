// PhoneDirectoryManagement.Application/Contracts/PhoneDirectory/Dtos.cs
using Epc.Application.Command;

namespace PhoneDirectoryManagement.Application.Contracts.PhoneDirectory;

public class EditPhoneDirectoryEntryDto: CreatePhoneDirectoryEntryDto
{
    public Guid Guid { get; set; }
}
