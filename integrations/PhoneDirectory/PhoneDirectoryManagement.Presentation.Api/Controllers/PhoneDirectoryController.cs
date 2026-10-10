// PhoneDirectoryManagement.Presentation.Api/Controllers/PhoneDirectoryController.cs
using Epc.Company.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PhoneDirectoryManagement.Application.Contracts.PhoneDirectory;
using PhoneDirectoryManagement.Common;
using PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;
using PhoneDirectoryManagement.Presentation.Facade.Contracts.PhoneDirectory;

namespace PhoneDirectoryManagement.Presentation.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class PhoneDirectoryController(
    IPhoneDirectoryQueryFacade queryFacade,
    IPhoneDirectoryCommandFacade commandFacade) : ControllerBase
{
    // ── Query ─────────────────────────────────────────────────────────────

    /// <summary>لیست صفحه‌بندی‌شده برای پنل مدیریت</summary>
    [HttpPost("GetList")]
    public async Task<Result<PagedResult<PhoneDirectoryListModel>>> GetList(
        [FromBody] PhoneDirectoryListSearchDto condition) =>
        await queryFacade.GetList(condition);

    /// <summary>جزئیات کامل برای ویرایش</summary>
    [HttpGet("GetForEdit/{guid:guid}")]
    public async Task<Result<PhoneDirectoryJsonModel>> GetDetails(Guid guid) =>
        await queryFacade.GetDetails(guid);

    /// <summary>جستجو در دفترچه تلفن — برای استفاده سایر سامانه‌ها پس از ورود از SSO</summary>
    ///
    [AllowAnonymous]
    [HttpPost("Search")]
    public async Task<Result<List<PhoneDirectoryPublicModel>>> Search(
        [FromBody] PhoneDirectorySearchDto condition) =>
        await queryFacade.Search(condition);

    [HttpPost("SearchPaginated")]
    [AllowAnonymous]
    public async Task<Result<object>> SearchPaginated(PhoneDirectorySearchPaginatedDto condition)
    {
        var result = await queryFacade.Search(new PhoneDirectorySearchDto() { Search = condition.Search , Type = condition.Type });

        if (!result.IsSuccess)
            return Result<object>.Failure(null, result.Message);

        var total = result.Data.Count;
        var items = result.Data
            .Skip((condition.Page - 1) * condition.PageSize)
            .Take(condition.PageSize)
            .ToList();

        return Result<object>.Success(new
        {
            items,
            total,
            condition.Page,
            condition.PageSize
        });
    }
    /// <summary>
    /// جستجوی کامل برای صفحه‌ی داخلی «شماره‌گیری» — نیاز به احراز هویت دارد.
    /// بر خلاف Search (که برای سامانه‌های دیگر و بدون auth است)، این مدل
    /// غنی‌تر است (شبیه GetList) اما بدون صفحه‌بندی و بدون Description.
    /// </summary>
    [HttpPost("GetForDialer")]
    public async Task<Result<List<PhoneDirectoryDialerModel>>> GetForDialer(
        [FromBody] PhoneDirectoryDialerSearchDto condition) =>
        await queryFacade.GetForDialer(condition);

    // ── Command ───────────────────────────────────────────────────────────
    [HttpPost("Create")]
    public async Task<Result<Guid>> Create([FromBody] CreatePhoneDirectoryEntryDto command) =>
        await commandFacade.Create(command);

    [HttpPost("Edit")]
    public async Task<Result<bool>> Edit([FromBody] EditPhoneDirectoryEntryDto command) =>
        await commandFacade.Edit(command);

    [HttpPost("Delete/{guid:guid}")]
    public async Task<Result<bool>> Delete(Guid guid) =>
        await commandFacade.Delete(guid);

    [HttpPost("Activate/{guid:guid}")]
    public async Task<Result<bool>> Activate(Guid guid) =>
        await commandFacade.Activate(guid);

    [HttpPost("Deactivate/{guid:guid}")]
    public async Task<Result<bool>> Deactivate(Guid guid) =>
        await commandFacade.Deactivate(guid);
    [HttpPost("CheckDuplicatePosition")]
    public async Task<Result<bool>> CheckDuplicatePosition(
    [FromBody] CheckDuplicatePositionDto dto)
        => await queryFacade.CheckDuplicatePosition(dto);

    [HttpPost("CheckDuplicateLocation")]
    public async Task<Result<bool>> CheckDuplicateLocation(
        [FromBody] CheckDuplicateLocationDto dto) =>
        await queryFacade.CheckDuplicateLocation(dto);

}