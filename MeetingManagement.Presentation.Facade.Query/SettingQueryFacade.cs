using System.Collections.Generic;
using Epc.Application.Query;
using MeetingManagement.Infrastructure.Query.Contracts.Setting;
using MeetingManagement.Presentation.Facade.Contracts.Setting;

namespace MeetingManagement.Presentation.Facade.Query;
public class SettingQueryFacade(IQueryBus queryBus) : ISettingQueryFacade
{
    public List<SettingViewModel> GetSettings() => queryBus.Dispatch<List<SettingViewModel>>();
    public SettingViewModel GetById(int id) => queryBus.Dispatch<SettingViewModel, int>(id);
}