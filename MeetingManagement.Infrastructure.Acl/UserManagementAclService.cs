using MeetingManagement.Domain.Shared.Acls.UserManagement;
using Microsoft.Extensions.Configuration;
using RestSharp;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Infrastructure.Acl;

public class UserManagementAclService : IUserManagementAclService
{
    // ✅ RestClient یک‌بار ساخته و بین درخواست‌ها به اشتراک گذاشته می‌شود
    // (قبلاً در هر Scope یک HttpClient جدید ساخته می‌شد → خطر اتمام سوکت‌ها).
    private static readonly object ClientLock = new();
    private static RestClient? _sharedClient;
    private static string? _sharedBaseUrl;

    private readonly RestClient _client;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IServiceTokenProvider? _serviceTokenProvider;

    public UserManagementAclService(IConfiguration configuration, IHttpContextAccessor httpContextAccessor,
        IServiceTokenProvider? serviceTokenProvider = null)
    {
        if (configuration == null)
            throw new ArgumentNullException(nameof(configuration));
        _httpContextAccessor = httpContextAccessor;
        _serviceTokenProvider = serviceTokenProvider;

        var userManagementUrl = $"{configuration["UserManagementUrl"]?.TrimEnd('/')}/api/UserManagementAcl";
        lock (ClientLock)
        {
            if (_sharedClient is null || _sharedBaseUrl != userManagementUrl)
            {
                _sharedClient = new RestClient(new RestClientOptions(userManagementUrl) { Timeout = TimeSpan.FromSeconds(30) });
                _sharedBaseUrl = userManagementUrl;
            }
            _client = _sharedClient;
        }
    }

    /// <summary>توکن کاربر جاری؛ در نبود HttpContext (Job ها) توکن سرویس.</summary>
    private async Task<string?> GetTokenAsync()
    {
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrEmpty(token)) return token;
        return _serviceTokenProvider is null ? null : await _serviceTokenProvider.GetAuthorizationHeaderAsync();
    }

    public async Task<SystemViewHelper> GetSystemByAsync(string clientId)
    {

        var request = new RestRequest($"GetSystemDetails/{clientId}", Method.Post);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = await GetTokenAsync();
        if (!string.IsNullOrEmpty(token)) request.AddHeader("Authorization", token);
        return await ExecuteRequestAsync<SystemViewHelper>(request);
    }

    public async Task<UserViewHelper> GetUserByAsync(Guid guid)
    {
        if (guid == Guid.Empty)
            throw new ArgumentException("GUID cannot be empty.", nameof(guid));

        var request = new RestRequest($"GetUserBy/{guid}", Method.Get);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = await GetTokenAsync();
        if (!string.IsNullOrEmpty(token)) request.AddHeader("Authorization", token);
        return await ExecuteRequestAsync<UserViewHelper>(request);
    }

    public async Task<List<UserViewHelper>> GetUsersByGuidsAsync(List<Guid?> userGuids)
    {
        if (userGuids == null || !userGuids.Any())
        {
            return [];
        }

        // حذف GUIDهای null
        var validGuids = userGuids.Where(g => g.HasValue).Select(g => g.Value).ToList();

        // ایجاد درخواست
        var request = new RestRequest("GetUsersBy", Method.Post);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = await GetTokenAsync();
        if (!string.IsNullOrEmpty(token)) request.AddHeader("Authorization", token);
        request.AddJsonBody(validGuids);

        // ارسال درخواست و دریافت پاسخ
        return await ExecuteRequestAsync<List<UserViewHelper>>(request);
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
        var token = await GetTokenAsync();
        if (!string.IsNullOrEmpty(token)) request.AddHeader("Authorization", token);
        request.AddJsonBody(validGuids);

        // ارسال درخواست و دریافت پاسخ
        return await ExecuteRequestAsync<List<UserPositionHelper>>(request);
    }
    public async Task<List<UnitViewHelper>> GetUnitsByGuidsAsync(List<Guid?> userGuids)
    {
        if (userGuids == null || !userGuids.Any())
        {
            return [];
        }

        // حذف GUIDهای null
        var validGuids = userGuids.Where(g => g.HasValue).Select(g => g.Value).ToList();

        // ایجاد درخواست
        var request = new RestRequest("GetUnitsBy", Method.Post);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = await GetTokenAsync();
        if (!string.IsNullOrEmpty(token)) request.AddHeader("Authorization", token);
        request.AddJsonBody(validGuids);

        // ارسال درخواست و دریافت پاسخ
        return await ExecuteRequestAsync<List<UnitViewHelper>>(request);
    }
    public async Task<List<UnitViewHelper>> GetUnitsAsync()
    {
       
        // ایجاد درخواست
        var request = new RestRequest("GetUnits", Method.Get);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = await GetTokenAsync();
        if (!string.IsNullOrEmpty(token)) request.AddHeader("Authorization", token);

        // ارسال درخواست و دریافت پاسخ
        return await ExecuteRequestAsync<List<UnitViewHelper>>(request);
    }


    private async Task<T> ExecuteRequestAsync<T>(RestRequest request) where T : class
    {
        try
        {
            var response = await _client.ExecuteAsync<T>(request);
            if (!response.IsSuccessful)
            {
                throw new HttpRequestException($"Request failed. Status Code: {response.StatusCode}, Error: {response.ErrorMessage}");
            }

            return response.Data ?? throw new InvalidOperationException("Response data is null.");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[UserManagementAcl] {request.Resource}: {ex.Message}");
            throw;
        }
    }

    public async Task<List<PositionHelper>> GetPositionsByGuidsAsync(List<Guid?> positionGuids)
    {
        if (positionGuids == null || !positionGuids.Any())
        {
            return [];
        }

        // حذف GUIDهای null
        var validGuids = positionGuids.Where(g => g.HasValue).Select(g => g.Value).ToList();

        // ایجاد درخواست
        var request = new RestRequest("GetPositionsBy", Method.Post);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = await GetTokenAsync();
        if (!string.IsNullOrEmpty(token)) request.AddHeader("Authorization", token);
        request.AddJsonBody(validGuids);

        // ارسال درخواست و دریافت پاسخ
        return await ExecuteRequestAsync<List<PositionHelper>>(request);
    }
}
