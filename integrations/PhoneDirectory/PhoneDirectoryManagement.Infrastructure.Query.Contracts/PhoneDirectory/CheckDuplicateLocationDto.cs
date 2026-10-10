// PhoneDirectoryManagement.Infrastructure/Query/Contracts/PhoneDirectory/Dtos.cs
namespace PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;

public class CheckDuplicateLocationDto
{
    public string LocationTitle { get; set; } = string.Empty;
    public string? ExcludeGuid { get; set; }
}