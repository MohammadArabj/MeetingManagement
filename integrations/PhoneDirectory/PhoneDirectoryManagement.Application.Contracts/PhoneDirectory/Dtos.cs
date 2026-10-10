// PhoneDirectoryManagement.Application/Contracts/PhoneDirectory/Dtos.cs
using Epc.Application.Command;

namespace PhoneDirectoryManagement.Application.Contracts.PhoneDirectory;

public record DeletePhoneDirectoryEntryDto(Guid Guid):ICommand;
public record ActivatePhoneDirectoryEntryDto(Guid Guid):ICommand;
public record DeactivatePhoneDirectoryEntryDto(Guid Guid):ICommand;