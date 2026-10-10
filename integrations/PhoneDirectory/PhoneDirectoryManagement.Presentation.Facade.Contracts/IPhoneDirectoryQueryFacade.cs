// PhoneDirectoryManagement.Presentation.Facade.Contracts/PhoneDirectory/Interfaces.cs
using PhoneDirectoryManagement.Application.Contracts.PhoneDirectory;
using PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;
using Epc.Company.Query;
using Epc.Core;
using PhoneDirectoryManagement.Common;

namespace PhoneDirectoryManagement.Presentation.Facade.Contracts.PhoneDirectory;

public interface IPhoneDirectoryQueryFacade:IFacadeService
{
    Task<Result<PagedResult<PhoneDirectoryListModel>>> GetList(PhoneDirectoryListSearchDto condition);
    Task<Result<PhoneDirectoryJsonModel>> GetDetails(Guid guid);
    Task<Result<List<PhoneDirectoryPublicModel>>> Search(PhoneDirectorySearchDto condition);
    Task<Result<List<PhoneDirectoryDialerModel>>> GetForDialer(PhoneDirectoryDialerSearchDto condition);
    Task<Result<bool>> CheckDuplicatePosition(CheckDuplicatePositionDto dto);
    Task<Result<bool>> CheckDuplicateLocation(CheckDuplicateLocationDto dto);
}