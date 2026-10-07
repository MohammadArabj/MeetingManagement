using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Setting;


public class SettingViewModel
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Value { get; set; }
    public string Description { get; set; }
    public string FieldType { get; set; }
    public int? MinValue { get; set; }
    public int? MaxValue { get; set; }
    public string ListName { get; set; }
    public string ValueLabel { get; set; }
}
