using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace EPC.SSO.Filters;

/// <summary>
/// اگر رمز عبور کاربر موقت/منقضی باشد (claim: PasswordExpired = true)،
/// تا زمانی که رمز را تغییر نداده، دسترسی به هیچ صفحه دیگری مجاز نیست.
/// </summary>
public class ForcePasswordChangeFilter : IAsyncActionFilter
{
    // ─── این اکشن‌ها معاف هستند، وگرنه کاربر هیچوقت نمی‌تواند رمز را عوض کند یا خارج شود ───
    private static readonly (string Controller, string Action)[] AllowedActions =
    [
        ("Account", "ChangePassword"),
        ("Account", "Logout"),
        ("Account", "AccessDenied"),
        // مدیری که با کاربر دارای رمز منقضی وارد شده باید بتواند به حساب خودش برگردد
        ("Grants", "EndImpersonation"),
    ];

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var user = context.HttpContext.User;

        if (user.Identity?.IsAuthenticated == true)
        {
            var isExpired = user.FindFirst("PasswordExpired")?.Value;

            if (string.Equals(isExpired, "true", StringComparison.OrdinalIgnoreCase))
            {
                var controllerName = context.ActionDescriptor.RouteValues["controller"];
                var actionName = context.ActionDescriptor.RouteValues["action"];

                var isAllowed = AllowedActions.Any(a =>
                    string.Equals(a.Controller, controllerName, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(a.Action, actionName, StringComparison.OrdinalIgnoreCase));

                if (!isAllowed)
                {
                    context.Result = new RedirectToActionResult("ChangePassword", "Account", null);
                    return;
                }
            }
        }

        await next();
    }
}