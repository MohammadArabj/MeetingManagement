// PhoneDirectoryManagement.Presentation.Facade.Query/PhoneDirectoryQueryFacade.cs
using PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;
using PhoneDirectoryManagement.Presentation.Facade.Contracts.PhoneDirectory;
using Epc.Application.Query;
using Epc.Company.Query;
using PhoneDirectoryManagement.Common;

namespace PhoneDirectoryManagement.Presentation.Facade.Query;

public class PhoneDirectoryQueryFacade(IQueryBusAsync queryBus) : IPhoneDirectoryQueryFacade
{
    public async Task<Result<PagedResult<PhoneDirectoryListModel>>> GetList(PhoneDirectoryListSearchDto condition) =>
      await queryBus.Dispatch<Result<PagedResult<PhoneDirectoryListModel>>, PhoneDirectoryListSearchDto>(condition);

    public async Task<Result<PhoneDirectoryJsonModel>> GetDetails(Guid guid) =>
       await queryBus.Dispatch<Result<PhoneDirectoryJsonModel>, Guid>(guid);

    public async Task<Result<List<PhoneDirectoryPublicModel>>> Search(PhoneDirectorySearchDto condition) =>
       await queryBus.Dispatch<Result<List<PhoneDirectoryPublicModel>>, PhoneDirectorySearchDto>(condition);

    public async Task<Result<List<PhoneDirectoryDialerModel>>> GetForDialer(PhoneDirectoryDialerSearchDto condition) =>
        await queryBus.Dispatch<Result<List<PhoneDirectoryDialerModel>>, PhoneDirectoryDialerSearchDto>(condition);

    public async Task<Result<bool>> CheckDuplicatePosition(CheckDuplicatePositionDto dto)=>
        await queryBus.Dispatch<Result<bool>, CheckDuplicatePositionDto>(dto);

    public async Task<Result<bool>> CheckDuplicateLocation(CheckDuplicateLocationDto dto)
    {
        return await queryBus.Dispatch<Result<bool>, CheckDuplicateLocationDto>(dto);
    }
}