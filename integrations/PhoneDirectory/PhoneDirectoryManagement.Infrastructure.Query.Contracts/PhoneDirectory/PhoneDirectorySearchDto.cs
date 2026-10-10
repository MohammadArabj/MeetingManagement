// PhoneDirectoryManagement.Infrastructure/Query/Contracts/PhoneDirectory/Dtos.cs
namespace PhoneDirectoryManagement.Infrastructure.Query.Contracts.PhoneDirectory;

public class PhoneDirectorySearchDto
{
    public string? Search { get; set; }
    public int? Type { get; set; }
}


public class PhoneDirectorySearchPaginatedDto
{
    public string? Search { get; set; }
    public int? Type { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}