// PhoneDirectoryManagement.Infrastructure/Query/Contracts/PhoneDirectory/Dtos.cs
namespace PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;

public class PhoneDirectoryPublicModel
{
    public string Unit;

    public Guid Guid { get; set; }
    public int Type { get; set; }
    public string TypeLabel { get; set; }
    public string DisplayTitle { get; set; }
    public string? SubTitle { get; set; }
    public string? UserName { get; set; }
    public List<string> Numbers { get; set; } = [];
}
