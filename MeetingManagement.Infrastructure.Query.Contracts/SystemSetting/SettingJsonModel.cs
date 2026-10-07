namespace MeetingManagement.Infrastructure.Query.Contracts.SystemSetting;

public class SettingJsonModel
{
    public int Id { get; set; }
    public byte Key { get; set; }
    public string KeyName { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public byte ValueType { get; set; }
    public string ValueTypeName { get; set; } = string.Empty;
    public byte Category { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPublic { get; set; }
}
