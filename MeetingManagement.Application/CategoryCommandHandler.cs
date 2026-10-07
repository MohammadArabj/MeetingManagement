using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.Category;
using MeetingManagement.Domain.CategoryAgg;
using MeetingManagement.Domain.CategoryAgg.Service;

namespace MeetingManagement.Application;
public class CategoryCommandHandler(
    ICategoryRepository repository,
    IClaimHelper claimHelper,
    ICategoryService service
) : ICommandHandlerAsync<CreateCategoryDto, Result<Guid>>,
    ICommandHandlerAsync<EditCategoryDto, Result<bool>>,
    ICommandHandlerAsync<DeleteCategoryDto, Result<bool>>,
    ICommandHandlerAsync<ActivateCategoryDto, Result<bool>>,
    ICommandHandlerAsync<DeactivateCategoryDto, Result<bool>>,
    ICommandHandlerAsync<SetCategoryPermissionDto,Result<bool>>
{
    public async Task<Result<Guid>> Handle(CreateCategoryDto command)
    {
        var category = new Category(
            claimHelper.GetCurrentUserGuid(),
            command.Title,
            command.NumberFormat,
            command.StartNumber,
            command.ViewAll,
            command.ResetNumberYearly,
            command.Step,
            service
        );

        await repository.CreateAsync(category);
        return Result<Guid>.Success(category.Guid);
    }

    public async Task<Result<bool>> Handle(EditCategoryDto command)
    {
        var category = await repository.LoadAsync(command.Guid);
        if (category == null)
            return Result<bool>.Failure(false,"دسته بندی یافت نشد");

        category.Edit(
            claimHelper.GetCurrentUserGuid(),
            command.Title,
            command.NumberFormat,
            command.StartNumber,
            command.ResetNumberYearly,
            command.Step,
            service
        );

        repository.Update(category);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(DeleteCategoryDto command)
    {
        var category = await repository.LoadAsync(command.Guid);
        if (category == null)
            return Result<bool>.Failure(false,"دسته بندی یافت نشد");
        if(await service.HasHistoryAsync(category.Id))
            return Result<bool>.Failure(false,"به دلیل وجود سابقه امکان حذف وجود ندارد");
        repository.Delete(category);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(ActivateCategoryDto command)
    {
        var category = await repository.LoadAsync(command.Guid);
        if (category == null)
            return Result<bool>.Failure(false, "دسته بندی یافت نشد");

        category.Activate();
        repository.Update(category);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(DeactivateCategoryDto command)
    {
        var category = await repository.LoadAsync(command.Guid);
        if (category == null)
            return Result<bool>.Failure(false, "دسته بندی یافت نشد");

        category.Deactivate();
        repository.Update(category);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(SetCategoryPermissionDto command)
    {
        Category category = await repository.LoadAsync(command.Id);
        if (category == null)
            return Result<bool>.Failure(false, "دسته بندی یافت نشد");
        category.SetPermission(command.ViewAll);
        repository.Update(category);
        return Result<bool>.Success(true);
    }
}
