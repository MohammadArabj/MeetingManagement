// PhoneDirectoryManagement.Infrastructure/Acl/UserManagementAclService.cs
using Microsoft.Extensions.Configuration;
using RestSharp;
using Microsoft.AspNetCore.Http;
using PhoneDirectoryManagement.Domain.Shared.Acls.UserManagement;

namespace PhoneDirectoryManagement.Infrastructure.Acl;

/// <summary>
/// ✅ RestClient برای هر نشانی یک بار ساخته می‌شود (قبلاً با هر درخواست یک HttpClient تازه → اتصال سرد و
///    خطر تمام شدن پورت‌ها)، زمان انتظار ۲۰ ثانیه دارد (قبلاً بی‌نهایت/۱۰۰ ثانیه)، و درخواست بدون توکن
///    (جستجوی عمومی) دیگر با ArgumentNullException در AddHeader شکست نمی‌خورد.
/// </summary>
public class UserManagementAclService : IUserManagementAclService
{
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, RestClient> Clients = new();
    private readonly RestClient _client;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public UserManagementAclService(IConfiguration configuration, IHttpContextAccessor httpContextAccessor)
    {
        if (configuration == null)
            throw new ArgumentNullException(nameof(configuration));

        _httpContextAccessor = httpContextAccessor;
        var userManagementUrl = $"{configuration["UserManagementUrl"]?.TrimEnd('/')}/api/UserManagementAcl";
        _client = Clients.GetOrAdd(userManagementUrl, url => new RestClient(new RestClientOptions(url)
        {
            Timeout = TimeSpan.FromSeconds(20)
        }));
    }

    private void AddAuthorization(RestRequest request)
    {
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(token)) request.AddHeader("Authorization", token);
    }

    public async Task<List<UserPositionHelper>> GetUserAndPositionsByGuidsAsync(List<Guid?> userGuids)
    {
        if (userGuids == null || !userGuids.Any())
            return [];

        var validGuids = userGuids.Where(g => g.HasValue).Select(g => g!.Value).Distinct().ToList();
        if (validGuids.Count == 0) return [];

        var request = new RestRequest("GetUserAndPositionsBy", Method.Post);
        request.AddHeader("Accept", "application/json");
        AddAuthorization(request);
        request.AddJsonBody(validGuids);

        return await ExecuteRequestAsync<List<UserPositionHelper>>(request);
    }

    public async Task<List<PositionHelper>> GetPositionsByGuidsAsync(List<Guid?> positionGuids)
    {
        if (positionGuids == null || !positionGuids.Any())
            return [];

        var validGuids = positionGuids.Where(g => g.HasValue).Select(g => g!.Value).Distinct().ToList();
        if (validGuids.Count == 0) return [];

        var request = new RestRequest("GetPositionsBy", Method.Post);
        request.AddHeader("Accept", "application/json");
        AddAuthorization(request);
        request.AddJsonBody(validGuids);

        return await ExecuteRequestAsync<List<PositionHelper>>(request);
    }

    private async Task<T> ExecuteRequestAsync<T>(RestRequest request) where T : class
    {
        var response = await _client.ExecuteAsync<T>(request);
        if (!response.IsSuccessful)
            throw new HttpRequestException($"UserManagement request failed. Status Code: {response.StatusCode}, Error: {response.ErrorMessage}");

        return response.Data ?? throw new InvalidOperationException("Response data is null.");
    }
}
