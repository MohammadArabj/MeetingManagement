// PhoneDirectoryManagement.Presentation.Facade.Command/PhoneDirectoryCommandFacade.cs
using PhoneDirectoryManagement.Application.Contracts.PhoneDirectory;
using PhoneDirectoryManagement.Presentation.Facade.Contracts.PhoneDirectory;
using Epc.Application.Command;
using Epc.Company.Query;

namespace PhoneDirectoryManagement.Presentation.Facade.Command;

public class PhoneDirectoryCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync)
    : IPhoneDirectoryCommandFacade
{
    public async Task<Result<Guid>> Create(CreatePhoneDirectoryEntryDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreatePhoneDirectoryEntryDto, Result<Guid>>(command);

    public async Task<Result<bool>> Edit(EditPhoneDirectoryEntryDto command) =>
        await responsiveCommandBusAsync.Dispatch<EditPhoneDirectoryEntryDto, Result<bool>>(command);

    public async Task<Result<bool>> Delete(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeletePhoneDirectoryEntryDto, Result<bool>>(new DeletePhoneDirectoryEntryDto(guid));

    public async Task<Result<bool>> Activate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<ActivatePhoneDirectoryEntryDto, Result<bool>>(new ActivatePhoneDirectoryEntryDto(guid));

    public async Task<Result<bool>> Deactivate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeactivatePhoneDirectoryEntryDto, Result<bool>>(new DeactivatePhoneDirectoryEntryDto(guid));
}