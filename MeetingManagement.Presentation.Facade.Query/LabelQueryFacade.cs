using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Label;
using MeetingManagement.Presentation.Facade.Contracts.Label;

namespace MeetingManagement.Presentation.Facade.Query;

public class LabelQueryFacade(IQueryBusAsync queryBusAsync): ILabelQueryFacade
{
    public async Task<Result<List<LabelListDto>>> List() => await queryBusAsync.Dispatch<Result<List<LabelListDto>>>();
    public async Task<Result<LabelDetailDto>> GetDetails(Guid guid) => await queryBusAsync.Dispatch<Result<LabelDetailDto>, Guid>(guid);
    public async Task<Result<List<LabelComboDto>>> GetForCombo() => await queryBusAsync.Dispatch<Result<List<LabelComboDto>>>();
}