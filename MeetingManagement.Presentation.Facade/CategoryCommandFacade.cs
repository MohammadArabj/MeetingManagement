using System;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Core.Events;
using MeetingManagement.Application.Contracts.Category;
using MeetingManagement.Presentation.Facade.Contracts.Category;

namespace MeetingManagement.Presentation.Facade.Command;

public class CategoryCommandFacade(
    ICommandBusAsync commandBusAsync,
    IResponsiveCommandBusAsync responsiveCommandBusAsync,
    IEventAggregator eventAggregator)
    : ICategoryCommandFacade
{

    public async Task<Result<Guid>> Create(CreateCategoryDto command) =>
        await responsiveCommandBusAsync.Dispatch<CreateCategoryDto, Result<Guid>>(command);

    public async Task<Result<bool>> Edit(EditCategoryDto command) =>
        await responsiveCommandBusAsync.Dispatch<EditCategoryDto, Result<bool>>(command);

    public async Task<Result<bool>> Delete(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeleteCategoryDto, Result<bool>>(new DeleteCategoryDto(guid));

    public async Task<Result<bool>> Activate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<ActivateCategoryDto, Result<bool>>(new ActivateCategoryDto(guid));

    public async Task<Result<bool>> Deactivate(Guid guid) =>
        await responsiveCommandBusAsync.Dispatch<DeactivateCategoryDto, Result<bool>>(new DeactivateCategoryDto(guid));

    public async Task<Result<bool>> SetPermissions(SetCategoryPermissionDto permissions)=>
        await responsiveCommandBusAsync.Dispatch<SetCategoryPermissionDto, Result<bool>>(permissions);
}