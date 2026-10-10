// PhoneDirectoryManagement.Infrastructure/Query/Contracts/PhoneDirectory/Dtos.cs
namespace PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;

/// <summary>
/// مدل کامل برای صفحه‌ی شماره‌گیری داخلی — همون فیلدهای اصلی GetList
/// (بدون Description که فقط مخصوص پنل ادمین است، و بدون IsActive/Created
/// چون فقط رکوردهای فعال برگردانده می‌شوند و این‌ها برای UI شماره‌گیری بی‌مصرف‌اند).
/// </summary>
public class PhoneDirectoryDialerModel
{
    public Guid Guid { get; set; }
    public int Type { get; set; }
    public string TypeLabel { get; set; }
    public Guid? PositionGuid { get; set; }
    public string? PositionTitle { get; set; }
    public string? LocationTitle { get; set; }
    public string DisplayTitle { get; set; }
    public string? Description { get; set; }
    public string? Mobile { get; set; }
    public List<string> Numbers { get; set; } = [];
    public string? SubTitle { get; set; }
    public string? UserName { get; set; }
}

/// <summary>جستجوی کامل برای صفحه‌ی شماره‌گیری داخلی — نیاز به احراز هویت دارد.</summary>
public class PhoneDirectoryDialerSearchDto
{
    public string? Search { get; set; }
    public int? Type { get; set; }
}