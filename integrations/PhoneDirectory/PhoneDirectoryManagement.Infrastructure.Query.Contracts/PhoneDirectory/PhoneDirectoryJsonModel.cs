// PhoneDirectoryManagement.Infrastructure/Query/Contracts/PhoneDirectory/Dtos.cs
namespace PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;

public class PhoneDirectoryJsonModel
{
    public int Id { get; set; }
    public Guid Guid { get; set; }
    public string Type { get; set; }
    public Guid? PositionGuid { get; set; }
    public string? LocationTitle { get; set; }
    public List<string> Numbers { get; set; } = [];
    public bool IsActive { get; set; }
    public string Created { get; set; }
    public string? Description { get; set; }
}
