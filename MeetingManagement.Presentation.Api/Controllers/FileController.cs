using Azure;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.File;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Infrastructure.Query.Contracts.File;
using MeetingManagement.Presentation.Facade.Contracts.File;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FileController(IFileQueryFacade queryFacade,IFileCommandFacade commandFacade) : ControllerBase
    {
        [HttpGet("GetFiles")]
        public async Task<Result<List<FileDetailsDto>>> GetFiles(long moduleId, FileType type) => await queryFacade.GetFiles(new FileParameterDto() { ModuleId = moduleId, Type = type });

        [HttpPost("DeleteFile/{id:long}")]
        public async Task<Result<bool>> DeleteFile(long id) => await commandFacade.DeleteFiles(new DeleteFileDto(id));
    }
}
