// PhoneDirectoryManagement.Presentation.Facade.Contracts/PhoneDirectory/Interfaces.cs
using Epc.Company.Query;
using Epc.Core;
using PhoneDirectoryManagement.Application.Contracts.PhoneDirectory;

namespace PhoneDirectoryManagement.Presentation.Facade.Contracts.PhoneDirectory;

public interface IPhoneDirectoryCommandFacade:IFacadeService
{
    Task<Result<Guid>> Create(CreatePhoneDirectoryEntryDto command);
    Task<Result<bool>> Edit(EditPhoneDirectoryEntryDto command);
    Task<Result<bool>> Delete(Guid guid);
    Task<Result<bool>> Activate(Guid guid);
    Task<Result<bool>> Deactivate(Guid guid);
}
