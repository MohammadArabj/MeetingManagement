using System;
using System.Threading;
using Autofac;
using Epc.Core;

namespace SurveyManagement.Presentation.Api.Services;

/// <summary>
/// ServiceLocator مبتنی بر Scope درخواست جاری (همان اصلاح سامانه جلسات).
/// ─────────────────────────────────────────────────────────────────────────
/// QueryBus/CommandBus پکیج Epc هندلرها را با <c>ServiceLocator.Current.Resolve</c> می‌سازند. با
/// AutofacServiceLocator پیش‌فرض (Container ریشه) همه‌ی وابستگی‌های InstancePerLifetimeScope
/// (DbContext، ClaimHelper، …) عملاً Singleton و بین همه‌ی درخواست‌ها و کاربران مشترک می‌شدند:
///   • «A second operation was started on this context instance…» در درخواست‌های همزمان
///   • باقی ماندن هویت/سمت درخواست قبلی (ثبت پاسخ یا نظرسنجی به نام کاربر دیگر)
///   • داده‌ی کهنه‌ی ChangeTracker بین درخواست‌ها
/// این کلاس هندلر را از Scope همان درخواست HTTP (یا Scope صریح کارهای پس‌زمینه) می‌سازد.
/// </summary>
public sealed class RequestScopedServiceLocator(ILifetimeScope root, IHttpContextAccessor httpContextAccessor) : IServiceLocator
{
    private static readonly AsyncLocal<IServiceProvider?> Ambient = new();

    /// <summary>برای کارهای پس‌زمینه: هندلرهای Bus در این بازه از همین Scope ساخته می‌شوند.</summary>
    public static IDisposable Use(IServiceProvider scope)
    {
        var previous = Ambient.Value;
        Ambient.Value = scope;
        return new Restore(previous);
    }

    public T Resolve<T>()
    {
        var provider = Ambient.Value ?? httpContextAccessor.HttpContext?.RequestServices;
        return provider is not null ? provider.GetRequiredService<T>() : root.Resolve<T>();
    }

    public void Release(object obj) { }
    public void Release(Type type) { }
    public void ReleaseAll() { }

    private sealed class Restore(IServiceProvider? previous) : IDisposable
    {
        public void Dispose() => Ambient.Value = previous;
    }
}
