using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Category;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Query;

public class CategoryQueryHandler(MeetingManagementQueryContext context)
    : IQueryHandlerAsync<Result<List<CategoryJsonModel>>>,
      IQueryHandlerAsync<Result<CategoryJsonModel>, Guid>,
      IQueryHandlerAsync<Result<List<CategoryComboModel>>>,
      IQueryHandlerAsync<Result<List<CategoryComboModel>>, CategoryComboSearchDto>
{
    public async Task<Result<List<CategoryJsonModel>>> Handle()
    {
        var categories = await context.Categories
            .Select(c => new CategoryJsonModel
            {
                Title = c.Title,
                Guid = c.Guid,
                Id = c.Id,
                IsActive = c.IsActive,
                NumberFormat = c.NumberFormat,
                StartNumber = c.StartNumber,
                Step = c.Step,
                ViewAll = c.ViewAll,
                Created = c.Created.ToString("yyyy/MM/dd"),
            })
            .ToListAsync();

        if (categories == null || !categories.Any())
            return Result<List<CategoryJsonModel>>.Failure([], "هیچ دسته‌ای یافت نشد.");

        return Result<List<CategoryJsonModel>>.EmptyMessage(categories);
    }

    public async Task<Result<CategoryJsonModel>> Handle(Guid condition)
    {
        var category = await context.Categories
            .Where(c => c.Guid == condition)
            .Select(c => new CategoryJsonModel
            {
                Guid = c.Guid,
                Title = c.Title,
                Id = c.Id,
                IsActive = c.IsActive,
                NumberFormat = c.NumberFormat,
                StartNumber = c.StartNumber,
                Step = c.Step,
                ViewAll = c.ViewAll,
                Created = c.Created.ToString("yyyy/MM/dd"),
            })
            .FirstOrDefaultAsync();

        return category == null ? Result<CategoryJsonModel>.Failure(null, "دسته مورد نظر یافت نشد.") : Result<CategoryJsonModel>.EmptyMessage(category);
    }

    public async Task<Result<List<CategoryComboModel>>> Handle(CategoryComboSearchDto condition)
    {
        var categoryIds = await context.CategoryPermissions.Where(x => x.PositionGuid == condition.PositionGuid).Select(x => x.CategoryId).ToListAsync();
        var categories = await context.Categories
            .WhereIf( condition.ShowAll==false ,x => categoryIds.Contains(x.Id) || x.ViewAll)
            .Select(c => new CategoryComboModel
            {
                Guid = c.Guid,
                Title = c.Title,
                Id = c.Id,
            })
            .ToListAsync();

        if (categories == null || !categories.Any())
            return Result<List<CategoryComboModel>>.Failure([], "هیچ دسته‌ای برای نمایش وجود ندارد.");

        return Result<List<CategoryComboModel>>.EmptyMessage(categories);
    }

    async Task<Result<List<CategoryComboModel>>> IQueryHandlerAsync<Result<List<CategoryComboModel>>>.Handle()
    {
        var categories = await context.Categories
            .Select(c => new CategoryComboModel
            {
                Guid = c.Guid,
                Title = c.Title,
                Id = c.Id,
            })
            .ToListAsync();

        if (categories == null || !categories.Any())
            return Result<List<CategoryComboModel>>.Failure([], "هیچ دسته‌ای برای نمایش وجود ندارد.");

        return Result<List<CategoryComboModel>>.EmptyMessage(categories);
    }
}
