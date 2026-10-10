// PhoneDirectoryManagement.Infrastructure/Query/Contracts/PhoneDirectory/Dtos.cs
namespace PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;

public class PhoneDirectoryListSearchDto
{
    public string? Search { get; set; }
    public int? Type { get; set; }
    public bool? IsActive { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}
