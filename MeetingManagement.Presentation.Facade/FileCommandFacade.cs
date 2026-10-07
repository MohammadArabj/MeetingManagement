using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.File;
using MeetingManagement.Presentation.Facade.Contracts.File;

namespace MeetingManagement.Presentation.Facade.Command;

public class FileCommandFacade(IResponsiveCommandBusAsync responsiveCommandBusAsync):IFileCommandFacade
{
    public async Task<Result<bool>> DeleteFiles(DeleteFileDto file) =>
        await responsiveCommandBusAsync.Dispatch<DeleteFileDto, Result<bool>>(file);
}