using System.Collections.Concurrent;
using Microsoft.Extensions.Configuration;
using RestSharp;
using Microsoft.AspNetCore.Http;
using SurveyManagement.Domain.Shared.Acls.UserManagement;

namespace SurveyManagement.Infrastructure.Acl;

public class UserManagementAclService : IUserManagementAclService
{
    // یک RestClient (و HttpClient زیر آن) برای کل برنامه؛ قبلاً با هر Resolve یک نمونه‌ی جدید ساخته می‌شد
    // (خطر اتمام سوکت‌ها) و هیچ Timeout نداشت (یک UserManagement کند، ثبت پاسخ‌ها را معطل می‌کرد).
    private static readonly ConcurrentDictionary<string, RestClient> Clients = new();
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(15);

    private readonly RestClient _client;
    private readonly IHttpContextAccessor _httpContextAccessor;
    public UserManagementAclService(IConfiguration configuration,IHttpContextAccessor httpContextAccessor)
    {
        if (configuration == null)
            throw new ArgumentNullException(nameof(configuration));
        _httpContextAccessor = httpContextAccessor;
        var userManagementUrl = $"{configuration["UserManagementUrl"]?.TrimEnd('/')}/api/UserManagementAcl";
        _client = Clients.GetOrAdd(userManagementUrl, url => new RestClient(new RestClientOptions(url) { Timeout = Timeout }));
    }

    public async Task<SystemViewHelper> GetSystemByAsync(string clientId)
    {

        var request = new RestRequest($"GetSystemDetails/{clientId}", Method.Post);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        request.AddHeader("Authorization", token);
        return await ExecuteRequestAsync<SystemViewHelper>(request);
    }

    public async Task<UserViewHelper> GetUserByAsync(Guid guid)
    {
        if (guid == Guid.Empty)
            throw new ArgumentException("GUID cannot be empty.", nameof(guid));

        var request = new RestRequest($"GetUserBy/{guid}", Method.Get);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        request.AddHeader("Authorization", token);
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
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        request.AddHeader("Authorization", token);
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
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        request.AddHeader("Authorization", token);
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
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        request.AddHeader("Authorization", token);
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
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        request.AddHeader("Authorization", token);

        // ارسال درخواست و دریافت پاسخ
        return await ExecuteRequestAsync<List<UnitViewHelper>>(request);
    }
    public async Task<UserDemographicViewHelper> GetUserDemographicsAsync(Guid userGuid)
    {
        var request = new RestRequest($"GetUserDemographics/{userGuid}", Method.Get);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Content-Type", "application/json");
        var token = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        request.AddHeader("Authorization", token);
        return await ExecuteRequestAsync<UserDemographicViewHelper>(request);
    }
    public Task<object> GetPositionsByGuidsAsync(List<Guid> positionGuids)
    {
        throw new NotImplementedException();
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
            System.Diagnostics.Trace.TraceWarning($"UserManagement ACL request {request.Resource} failed: {ex.Message}");
            throw;
        }
    }
}
