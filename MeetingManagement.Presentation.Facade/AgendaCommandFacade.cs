using System;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Presentation.Facade.Contracts.Agenda;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace MeetingManagement.Presentation.Facade.Command;

public class AgendaCommandFacade(
    ICommandBusAsync commandBusAsync,
    IResponsiveCommandBusAsync responsiveCommandBusAsync,IHttpContextAccessor httpContextAccessor,IConfiguration configuration)
    : IAgendaCommandFacade
{
    public async Task<Result<long>> CreateOrEdit(AgendaDto command) =>
        await responsiveCommandBusAsync.Dispatch<AgendaDto, Result<long>>(command);

    public async Task<Result<bool>> Delete(long id) =>
        await responsiveCommandBusAsync.Dispatch<DeleteAgenda,Result<bool>>(new DeleteAgenda(id));

    public async Task<Result<bool>> Order(UpdateAgendaOrderRequest orders) =>
        await responsiveCommandBusAsync.Dispatch<UpdateAgendaOrderRequest, Result<bool>>(orders);

    public async Task<Result<bool>> DeleteFile(long id)
    {
        // فاز ۱: حذف ارتباط فایل از دستور جلسه در دیتابیس
        var result = await  responsiveCommandBusAsync.Dispatch<DeleteAgendaFileDto, Result<Guid?>>(new DeleteAgendaFileDto(id));

        if (!result.IsSuccess )
            return Result<bool>.Failure(false, result.Message);

        var fileGuid = result.Data.Value;
        var token = httpContextAccessor.HttpContext?.Request.Headers["Authorization"].ToString();

        // فاز ۲: حذف فایل از سیستم فایل
        try
        {
            var deleteResult = await fileGuid.DeleteFileAsync(token, configuration);
            return !deleteResult.IsSuccess ? Result<bool>.Failure(false, "حذف فایل از سیستم فایل با خطا مواجه شد") : Result<bool>.Success(true);
        }
        catch (Exception ex)
        {
            // اختیاری: ثبت در جدول فایل‌های باقی‌مانده برای حذف بعدی
            return Result<bool>.Failure(false, "خطا در حذف فایل: " + ex.Message);
        }
    }
    
}
