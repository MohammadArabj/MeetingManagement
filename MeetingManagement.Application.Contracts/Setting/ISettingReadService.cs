using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MeetingManagement.Application.Contracts.Setting;

public interface ISettingReadService
{
    Task<Dictionary<string, string?>> GetAsync(params string[] names);

    Task<bool> GetBoolAsync(string name, bool defaultValue = false);
    Task<int> GetIntAsync(string name, int defaultValue = 0);
    Task<Guid?> GetGuidAsync(string name);
}