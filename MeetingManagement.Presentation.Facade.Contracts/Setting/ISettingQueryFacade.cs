using System.Collections.Generic;
using Epc.Core;
using MeetingManagement.Infrastructure.Query.Contracts.Setting;

namespace MeetingManagement.Presentation.Facade.Contracts.Setting;

public interface ISettingQueryFacade: IFacadeService
{
    List<SettingViewModel> GetSettings();

    SettingViewModel GetById(int id);
}

//برام یک متد خیلی خوب پیاده سازی کن