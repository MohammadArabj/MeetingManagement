using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Infrastructure.Query.Contracts.File;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Facade.Contracts.File;

public interface IFileQueryFacade:IFacadeService
{
    Task<Result<List<FileDetailsDto>>> GetFiles(FileParameterDto fileParameterDto);
}