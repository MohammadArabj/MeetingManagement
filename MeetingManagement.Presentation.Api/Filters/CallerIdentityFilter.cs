using System.Collections.Concurrent;
using System.Reflection;
using MeetingManagement.Common.Security;
using MeetingManagement.Domain.Shared.Access;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MeetingManagement.Presentation.Api.Filters;

/// <summary>
/// پیش از اجرای هر Action، ویژگی‌های «هویت فراخوان» در مدل‌های ورودی را با هویت راستی‌آزمایی‌شده پر می‌کند:
///   [CallerUser]            ← کاربر عامل
///   [CallerPosition]        ← سمت فعال
///   [CallerHasPermission]   ← آیا کاربر دسترسی مورد نظر را دارد
/// قبلاً فرانت این مقادیر را در بدنه‌ی درخواست می‌فرستاد و هر کاربری می‌توانست با تغییر آن‌ها
/// (مثلاً CanViewAll=true یا سمت شخص دیگر) جلسات و مصوبات دیگران را ببیند.
/// </summary>
public sealed class CallerIdentityFilter(IActingIdentityResolver identityResolver) : IAsyncActionFilter
{
    private static readonly ConcurrentDictionary<Type, CallerProperty[]> PropertyCache = new();

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (context.HttpContext.User.Identity?.IsAuthenticated == true)
        {
            ActingIdentity? identity = null;
            foreach (var argument in context.ActionArguments.Values)
            {
                if (argument is null) continue;
                var properties = GetCallerProperties(argument.GetType());
                if (properties.Length == 0) continue;

                identity ??= await identityResolver.ResolveAsync(context.HttpContext.RequestAborted);
                foreach (var property in properties)
                    property.Apply(argument, identity);
            }
        }

        await next();
    }

    private static CallerProperty[] GetCallerProperties(Type type) =>
        type.IsPrimitive || type == typeof(string) || type == typeof(Guid) || !type.IsClass
            ? []
            : PropertyCache.GetOrAdd(type, static t => t
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(p => p.CanWrite)
                .Select(CallerProperty.TryCreate)
                .OfType<CallerProperty>()
                .ToArray());

    private sealed class CallerProperty
    {
        private readonly PropertyInfo _property;
        private readonly Func<ActingIdentity, object?> _value;

        private CallerProperty(PropertyInfo property, Func<ActingIdentity, object?> value)
        {
            _property = property;
            _value = value;
        }

        public void Apply(object target, ActingIdentity identity) => _property.SetValue(target, _value(identity));

        public static CallerProperty? TryCreate(PropertyInfo property)
        {
            var type = Nullable.GetUnderlyingType(property.PropertyType) ?? property.PropertyType;

            if (property.IsDefined(typeof(CallerUserAttribute)) && type == typeof(Guid))
                return new CallerProperty(property, i => i.UserGuid);

            if (property.IsDefined(typeof(CallerPositionAttribute)) && type == typeof(Guid))
            {
                var nullable = Nullable.GetUnderlyingType(property.PropertyType) is not null;
                // سمت نامعلوم = Guid.Empty تا هیچ رکوردی با سمت خالی تطبیق نخورد
                return new CallerProperty(property, i => nullable ? i.PositionGuid : i.PositionGuid ?? Guid.Empty);
            }

            var permission = property.GetCustomAttribute<CallerHasPermissionAttribute>();
            if (permission is not null && type == typeof(bool))
                return new CallerProperty(property, i => i.HasAnyPermission(permission.Permissions));

            return null;
        }
    }
}
