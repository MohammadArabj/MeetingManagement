// PhoneDirectoryManagement.Infrastructure/Query/Contracts/PhoneDirectory/Dtos.cs
namespace PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;

public class PhoneDirectoryListModel
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
    public bool IsActive { get; set; }
    public string Created { get; set; }
}
