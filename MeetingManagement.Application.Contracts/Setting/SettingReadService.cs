using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Dapper;

namespace MeetingManagement.Application.Contracts.Setting;

public class SettingReadService(BaseDapperRepository repository) : ISettingReadService
{
    private sealed class Row { public string Name { get; set; } = ""; public string? Value { get; set; } }

    public async Task<Dictionary<string, string?>> GetAsync(params string[] names)
    {
        var sql = """
                  SELECT S.[Name],
                         CONVERT(nvarchar(max), SD.[Value]) AS [Value]
                  FROM dbo.Settings S
                  LEFT JOIN dbo.SettingDetails SD ON SD.SettingId = S.Id
                  WHERE S.[Name] IN @Names
                  """;

        var rows =  repository.Select<Row>(sql, new { Names = names });
        return rows.ToDictionary(x => x.Name, x => x.Value);
    }

    public async Task<bool> GetBoolAsync(string name, bool defaultValue = false)
    {
        var dict = await GetAsync(name);
        if (!dict.TryGetValue(name, out var val) || string.IsNullOrWhiteSpace(val)) return defaultValue;
        return val == "1" || val.Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<int> GetIntAsync(string name, int defaultValue = 0)
    {
        var dict = await GetAsync(name);
        if (!dict.TryGetValue(name, out var val) || string.IsNullOrWhiteSpace(val)) return defaultValue;
        return int.TryParse(val, out var i) ? i : defaultValue;
    }

    public async Task<Guid?> GetGuidAsync(string name)
    {
        var dict = await GetAsync(name);
        if (!dict.TryGetValue(name, out var val) || string.IsNullOrWhiteSpace(val)) return null;
        return Guid.TryParse(val, out var g) ? g : null;
    }
}