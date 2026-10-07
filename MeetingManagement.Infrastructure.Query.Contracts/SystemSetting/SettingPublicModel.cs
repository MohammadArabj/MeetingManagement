namespace MeetingManagement.Infrastructure.Query.Contracts.SystemSetting;

public class SettingPublicModel
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public byte ValueType { get; set; }
}
