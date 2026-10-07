using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.FileValidation;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Infrastructure.Query.Contracts.File;
using MeetingManagement.Presentation.Facade.Contracts.File;
using Microsoft.AspNetCore.Mvc;

namespace MeetingManagement.Presentation.Facade.Query;

public class FileQueryFacade(IQueryBusAsync queryBusAsync) : IFileQueryFacade
{
    public async Task<Result<List<FileDetailsDto>>> GetFiles(FileParameterDto fileParameterDto) =>
        await queryBusAsync.Dispatch<Result<List<FileDetailsDto>>, FileParameterDto>(fileParameterDto);
}