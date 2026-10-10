// PhoneDirectoryManagement.Infrastructure/Acl/UserManagementAclService.cs
using Microsoft.Extensions.Configuration;
using RestSharp;
using Microsoft.AspNetCore.Http;
using PhoneDirectoryManagement.Domain.Shared.Acls.UserManagement;

namespace PhoneDirectoryManagement.Infrastructure.Acl;

public class UserManagementAclService : IUserManagementAclService
{
    private readonly RestClient _client;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public UserManagementAclService(IConfiguration configuration, IHttpContextAccessor httpContextAccessor)
    {
        if (configuration == null)
            throw new ArgumentNullException(nameof(configuration));

        _httpContextAccessor = httpContextAccessor;
        var userManagementUrl = $"{configuration["UserManagementUrl"]}/api/UserManagementAcl";
        var options = new RestClientOptions(userManagementUrl);
        _client = new RestClient(options);
    }

    public async Task<List<UserPositionHelper>> GetUserAndPositionsByGuidsAsync(List<Guid?> userGuids)
    {
        if (userGuids == null || !userGuids.Any())
        {
            return [];
        }

        // حذف GUIDهای null
        var validGuids = userGuids.Where(g => g.HasValue).Select(g => g.Value).ToList();

        // ایجاد درخواست
        var request = new RestRequest("GetUserAndPositionsBy", Method.Post);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        request.AddHeader("Authorization", token);
        request.AddJsonBody(validGuids);

        // ارسال درخواست و دریافت پاسخ
        return await ExecuteRequestAsync<List<UserPositionHelper>>(request);
    }

    public async Task<List<PositionHelper>> GetPositionsByGuidsAsync(List<Guid?> positionGuids)
    {
        if (positionGuids == null || !positionGuids.Any())
            return [];

        var validGuids = positionGuids.Where(g => g.HasValue).Select(g => g.Value).ToList();

        var request = new RestRequest("GetPositionsBy", Method.Post);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        request.AddHeader("Authorization", token);
        request.AddJsonBody(validGuids);

        return await ExecuteRequestAsync<List<PositionHelper>>(request);
    }

    private async Task<T> ExecuteRequestAsync<T>(RestRequest request) where T : class
    {
        try
        {
            var response = await _client.ExecuteAsync<T>(request);
            if (!response.IsSuccessful)
                throw new HttpRequestException($"Request failed. Status Code: {response.StatusCode}, Error: {response.ErrorMessage}");

            return response.Data ?? throw new InvalidOperationException("Response data is null.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"An error occurred: {ex.Message}");
            throw;
        }
    }
}