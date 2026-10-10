// PhoneDirectoryManagement.Infrastructure/Query/PhoneDirectoryQueryHandler.cs
using PhoneDirectoryManagement.Common;
using PhoneDirectoryManagement.Domain.Shared.Acls.UserManagement;
using PhoneDirectoryManagement.Infrastructure.Persistence;
using PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;
using Epc.Application.Query;
using Epc.Company.Query;
using Microsoft.EntityFrameworkCore;

namespace PhoneDirectoryManagement.Infrastructure.Query;

public class PhoneDirectoryQueryHandler(
    PhoneDirectoryManagementQueryContext context,
    IUserManagementAclService userManagementAclService)
    : IQueryHandlerAsync<Result<PagedResult<PhoneDirectoryListModel>>, PhoneDirectoryListSearchDto>,
      IQueryHandlerAsync<Result<PhoneDirectoryJsonModel>, Guid>,
      IQueryHandlerAsync<Result<List<PhoneDirectoryPublicModel>>, PhoneDirectorySearchDto>,
      IQueryHandlerAsync<Result<List<PhoneDirectoryDialerModel>>, PhoneDirectoryDialerSearchDto>,
    IQueryHandlerAsync<Result<bool>, CheckDuplicatePositionDto>,
    IQueryHandlerAsync<Result<bool>, CheckDuplicateLocationDto>

{
    private static readonly Dictionary<PhoneDirectoryEntryType, string> TypeLabels = new()
    {
        [PhoneDirectoryEntryType.Position] = "سمت سازمانی",
        [PhoneDirectoryEntryType.Location] = "مکان",
    };

    // ── لیست صفحه‌بندی‌شده برای پنل مدیریت ─────────────────────────────
    public async Task<Result<PagedResult<PhoneDirectoryListModel>>> Handle(PhoneDirectoryListSearchDto condition)
    {
        var query = context.PhoneDirectoryEntries
            .Include(x => x.Numbers)
            .Where(x => !x.IsRemoved)
            .AsQueryable();

        if (condition.Type.HasValue)
            query = query.Where(x => (int)x.Type == condition.Type.Value);

        if (condition.IsActive.HasValue)
            query = query.Where(x => x.IsActive == (condition.IsActive.Value ? 1 : 0));

        if (!string.IsNullOrWhiteSpace(condition.Search))
            query = query.Where(x =>
                (x.LocationTitle != null && x.LocationTitle.Contains(condition.Search)) ||
                x.Numbers.Any(n => n.Number.Contains(condition.Search)));

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(x => x.Created)
            .Skip((condition.Page - 1) * condition.PageSize)
            .Take(condition.PageSize)
            .Select(x => new
            {
                x.Guid,
                x.Type,
                x.PositionGuid,
                x.LocationTitle,
                x.IsActive,
                x.Created,
                x.Description,
                Numbers = x.Numbers.OrderBy(n => n.DisplayOrder).Select(n => n.Number).ToList()
            })
            .ToListAsync();

        var positionGuids = items.Where(x => x.PositionGuid.HasValue).Select(x => x.PositionGuid).Distinct().ToList();
        var holders = positionGuids.Any()
            ? await userManagementAclService.GetUserAndPositionsByGuidsAsync(positionGuids)
            : [];
        var holdersDict = holders
                            .GroupBy(h => h.PositionGuid)
                            .ToDictionary(g => g.Key, g => g.First());

        var result = items.Select(x =>
        {
            var positionTitle = x.PositionGuid.HasValue && holdersDict.TryGetValue(x.PositionGuid.Value, out var h)
                ? h.Position : null;
            var userTitle = x.PositionGuid.HasValue && holdersDict.TryGetValue(x.PositionGuid.Value, out var hh)
              ? hh.Name : null;
            var displayTitle = x.Type == PhoneDirectoryEntryType.Position
                ? userTitle ?? "(سمت نامشخص)"
                : x.LocationTitle ?? "(بدون عنوان)";
            var mobile = x.PositionGuid.HasValue && holdersDict.TryGetValue(x.PositionGuid.Value, out var mo)?mo.Mobile:null;

            return new PhoneDirectoryListModel
            {
                Guid = x.Guid,
                Type = (int)x.Type,
                TypeLabel = TypeLabels[x.Type],
                PositionGuid = x.PositionGuid,
                PositionTitle = positionTitle,
                LocationTitle = x.LocationTitle,
                DisplayTitle = displayTitle,
                Description=x.Description,
                Mobile=mobile,
                Numbers = x.Numbers,
                IsActive = x.IsActive == 1,
                Created = x.Created.ToString("yyyy/MM/dd"),
            };
        }).ToList();

        return Result<PagedResult<PhoneDirectoryListModel>>.EmptyMessage(new PagedResult<PhoneDirectoryListModel>
        {
            Items = result,
            Total = total,
            Page = condition.Page,
            PageSize = condition.PageSize,
        });
    }

    // ── جزئیات برای ویرایش ────────────────────────────────────────────
    public async Task<Result<PhoneDirectoryJsonModel>> Handle(Guid condition)
    {
        var x = await context.PhoneDirectoryEntries
            .Include(a => a.Numbers)
            .FirstOrDefaultAsync(a => a.Guid == condition && !a.IsRemoved);

        if (x == null)
            return Result<PhoneDirectoryJsonModel>.Failure(null, "مخاطب یافت نشد.");

        var model = new PhoneDirectoryJsonModel
        {
            Id = x.Id,
            Guid = x.Guid,
            Type = ((int)x.Type).ToString(),
            PositionGuid = x.PositionGuid,
            LocationTitle = x.LocationTitle,
            Description = x.Description,
            Numbers = x.Numbers.OrderBy(n => n.DisplayOrder).Select(n => n.Number).ToList(),
            IsActive = x.IsActive == 1,
            Created = x.Created.ToString("yyyy/MM/dd HH:mm"),
        };

        return Result<PhoneDirectoryJsonModel>.EmptyMessage(model);
    }

    // ── دفترچه تلفن عمومی — برای استفاده سایر سامانه‌ها پس از SSO ───────
    // از نسخه‌ی آماده‌ی حافظه (PhoneDirectorySnapshot)؛ قبلاً هر جستجو کل جدول + UserManagement را می‌خواند.
    public async Task<Result<List<PhoneDirectoryPublicModel>>> Handle(PhoneDirectorySearchDto condition)
    {
        var entries = await PhoneDirectorySnapshot.GetAsync(BuildSnapshotAsync);
        var items = PhoneDirectorySnapshot.Filter(entries, condition.Search, condition.Type, full: false)
            .Select(e => new PhoneDirectoryPublicModel
            {
                Guid = e.Model.Guid,
                Type = e.Model.Type,
                TypeLabel = e.Model.TypeLabel,
                DisplayTitle = e.Model.DisplayTitle,
                // عمومی: فقط نام متصدی (بدون کد پرسنلی)، مانند قبل
                SubTitle = e.Model.Type == (int)PhoneDirectoryEntryType.Position
                    ? (e.Model.PositionTitle is null && e.Model.UserName == "" ? "(فاقد متصدی)" : e.HolderName ?? "(فاقد متصدی)")
                    : null,
                UserName = e.Model.UserName ?? "",
                Unit = e.Unit ?? "",
                Numbers = e.Model.Numbers
            })
            .ToList();
        return Result<List<PhoneDirectoryPublicModel>>.Success(items);
    }

    // ── جستجوی کامل برای صفحه‌ی شماره‌گیری داخلی (نیاز به احراز هویت) ────
    public async Task<Result<List<PhoneDirectoryDialerModel>>> Handle(PhoneDirectoryDialerSearchDto condition)
    {
        var entries = await PhoneDirectorySnapshot.GetAsync(BuildSnapshotAsync);
        var items = PhoneDirectorySnapshot.Filter(entries, condition.Search, condition.Type, full: true)
            .Select(e => e.Model)
            .ToList();
        return Result<List<PhoneDirectoryDialerModel>>.EmptyMessage(items);
    }

    /// <summary>ساخت نسخه‌ی کامل: یک Query سبک (بدون ردیابی) + یک درخواست به UserManagement</summary>
    private async Task<List<PhoneDirectorySnapshot.Entry>> BuildSnapshotAsync()
    {
        var rawItems = await context.PhoneDirectoryEntries
            .AsNoTracking()
            .Where(x => !x.IsRemoved && x.IsActive == 1)
            .Select(x => new
            {
                x.Guid,
                x.Type,
                x.PositionGuid,
                x.Description,
                x.LocationTitle,
                Numbers = x.Numbers.OrderBy(n => n.DisplayOrder).Select(n => n.Number).ToList()
            })
            .ToListAsync();

        var positionGuids = rawItems.Where(x => x.PositionGuid.HasValue).Select(x => x.PositionGuid).Distinct().ToList();
        var holders = positionGuids.Any()
            ? await userManagementAclService.GetUserAndPositionsByGuidsAsync(positionGuids)
            : [];
        var holdersDict = holders
            .GroupBy(h => h.PositionGuid)
            .ToDictionary(g => g.Key, g => g.First());

        return rawItems.Select(x =>
        {
            var holder = x.PositionGuid.HasValue && holdersDict.TryGetValue(x.PositionGuid.Value, out var h) ? h : null;
            var isPosition = x.Type == PhoneDirectoryEntryType.Position;
            var model = new PhoneDirectoryDialerModel
            {
                Guid = x.Guid,
                Type = (int)x.Type,
                TypeLabel = TypeLabels[x.Type],
                PositionGuid = x.PositionGuid,
                PositionTitle = holder?.Position,
                LocationTitle = x.LocationTitle,
                DisplayTitle = isPosition ? holder?.Position ?? "(سمت نامشخص)" : x.LocationTitle ?? "(بدون عنوان)",
                SubTitle = isPosition
                    ? (holder?.Name is not null
                        ? $"{holder.Name}{(holder.UserName is not null ? " — " + holder.UserName : "")}"
                        : "(فاقد متصدی)")
                    : null,
                UserName = holder?.UserName ?? "",
                Mobile = holder?.Mobile,
                Description = x.Description,
                Numbers = x.Numbers
            };
            var digits = string.Join(' ', x.Numbers.Select(PhoneDirectorySnapshot.Digits));
            var publicText = PhoneDirectorySnapshot.Normalize(string.Join(' ',
                model.DisplayTitle, holder?.Name, holder?.Unit, string.Join(' ', x.Numbers), digits));
            var fullText = PhoneDirectorySnapshot.Normalize(string.Join(' ',
                publicText, model.PositionTitle, model.LocationTitle, model.Mobile, model.Description, holder?.UserName));
            return new PhoneDirectorySnapshot.Entry(model, holder?.Unit, holder?.Name, publicText, fullText);
        }).ToList();
    }

    public async Task<Result<bool>> Handle(CheckDuplicateLocationDto condition)
    {
        var title = condition.LocationTitle.Trim();
        var exists = await context.PhoneDirectoryEntries
            .Where(x => !x.IsRemoved)
            .Where(x => x.LocationTitle == title)
            .Where(x => string.IsNullOrEmpty(condition.ExcludeGuid) || x.Guid != Guid.Parse(condition.ExcludeGuid))
            .AnyAsync();
        return Result<bool>.EmptyMessage(exists);
    }

    public async Task<Result<bool>> Handle(CheckDuplicatePositionDto condition)
    {
        var exists = await context.PhoneDirectoryEntries
        .Where(x => !x.IsRemoved)
        .Where(x => x.PositionGuid == condition.PositionGuid)
        .Where(x => string.IsNullOrEmpty(condition.ExcludeGuid) || x.Guid != Guid.Parse(condition.ExcludeGuid))
        .AnyAsync();
        return Result<bool>.EmptyMessage(exists);
    }
}

