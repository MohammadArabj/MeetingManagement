using System.Threading.Tasks;
using Epc.Application.FileValidation;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Application.Contracts.File;

namespace MeetingManagement.Presentation.Facade.Contracts.File;

public interface IFileCommandFacade:IFacadeService
{
    Task<Result<bool>> DeleteFiles(DeleteFileDto file);
}