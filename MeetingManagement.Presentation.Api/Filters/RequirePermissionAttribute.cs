using MeetingManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MeetingManagement.Presentation.Api.Filters;

/// <summary>
/// محدودسازی Endpoint به دارندگان حداقل یکی از دسترسی‌های سیستمی (claim: permission) یا مدیر سامانه.
/// قبلاً صفحات تنظیمات فقط در منو مخفی بودند و API ها برای همه باز بود.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class RequirePermissionAttribute(params string[] permissions) : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.ActionDescriptor.EndpointMetadata.OfType<Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute>().Any())
            return;

        var services = context.HttpContext.RequestServices;
        var currentUser = services.GetRequiredService<ICurrentUser>();
        if (!currentUser.IsAuthenticated)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        if (permissions.Any(currentUser.HasPermission)) return;

        var identity = await services.GetRequiredService<IActingIdentityResolver>().ResolveAsync(context.HttpContext.RequestAborted);
        if (identity.IsSuperAdmin) return;

        context.Result = new ObjectResult(new { isSuccess = false, message = "شما به این بخش دسترسی ندارید." })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }
}
