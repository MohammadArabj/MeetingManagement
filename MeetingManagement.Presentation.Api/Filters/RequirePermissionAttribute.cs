using MeetingManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MeetingManagement.Presentation.Api.Filters;

/// <summary>
/// محدودسازی Endpoint به دارندگان حداقل یکی از دسترسی‌های سیستمی سمت/تفویض فعال (یا مدیر سامانه).
/// دسترسی‌ها از UserManagement برای همان سمت راستی‌آزمایی می‌شوند (<see cref="IActingIdentityResolver"/>).
/// اگر روی کلاس و متد هر دو باشد، هر دو باید برقرار باشند.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequirePermissionAttribute(params string[] permissions) : Attribute, IAsyncAuthorizationFilter
{
    public IReadOnlyList<string> Permissions { get; } = permissions;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.ActionDescriptor.EndpointMetadata.OfType<AllowAnonymousAttribute>().Any())
            return;

        if (context.HttpContext.User.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var identity = await context.HttpContext.RequestServices
            .GetRequiredService<IActingIdentityResolver>()
            .ResolveAsync(context.HttpContext.RequestAborted);

        if (identity.HasAnyPermission(Permissions)) return;

        context.Result = new ObjectResult(new { isSuccess = false, message = "شما به این بخش دسترسی ندارید." })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }
}
