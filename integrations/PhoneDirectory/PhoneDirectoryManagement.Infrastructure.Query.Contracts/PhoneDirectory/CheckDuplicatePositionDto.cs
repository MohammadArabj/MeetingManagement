// PhoneDirectoryManagement.Infrastructure/Query/Contracts/PhoneDirectory/Dtos.cs
namespace PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;

public class CheckDuplicatePositionDto
{
    public Guid PositionGuid { get; set; }
    public string? ExcludeGuid { get; set; }
}
