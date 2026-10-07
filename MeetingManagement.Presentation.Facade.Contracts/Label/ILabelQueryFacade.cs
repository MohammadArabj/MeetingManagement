using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.Label;

namespace MeetingManagement.Presentation.Facade.Contracts.Label;

public interface ILabelQueryFacade:IFacadeService
{
    Task<Result<List<LabelListDto>>> List();
    Task<Result<LabelDetailDto>> GetDetails(Guid guid);
    Task<Result<List<LabelComboDto>>> GetForCombo();
}