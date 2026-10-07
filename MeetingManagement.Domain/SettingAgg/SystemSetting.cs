using Epc.Domain;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Domain.SettingAgg;

public class SystemSetting
{
    public int Id { get; set; }
    public SystemSetting() { }

    public SystemSetting(
        Guid creator,
        SettingKey key,
        string value,
        SettingValueType valueType,
        SettingCategory category,
        string displayName,
        string? description = null,
        bool isPublic = true)
    {
        Key = key;
        Value = value;
        ValueType = valueType;
        Category = category;
        DisplayName = displayName;
        Description = description;
        IsPublic = isPublic;
    }

    public SettingKey Key { get; private set; }
    public string Value { get; private set; } = string.Empty;
    public SettingValueType ValueType { get; private set; }
    public SettingCategory Category { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsPublic { get; private set; } = true;

    public void UpdateValue(Guid actor, string newValue)
    {
        Value = newValue;
    }

    public void Edit(
        Guid actor,
        string value,
        string displayName,
        string? description,
        bool isPublic)
    {
        Value = value;
        DisplayName = displayName;
        Description = description;
        IsPublic = isPublic;
    }
}