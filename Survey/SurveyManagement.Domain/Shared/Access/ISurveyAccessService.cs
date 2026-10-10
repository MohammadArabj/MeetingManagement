using SurveyManagement.Common;

namespace SurveyManagement.Domain.Shared.Access;

/// <summary>
/// دسترسی کاربر جاری به یک نظرسنجی مشخص (سمت سرور؛ مستقل از فرانت).
///  • مدیر سامانه (مدیر کل یا SV_Admin): همه‌ی نظرسنجی‌ها؛ ویرایش در هر وضعیت
///  • مالک (ایجادکننده): فقط نظرسنجی‌های خودش؛ ویرایش فقط تا پیش از انتشار (پیش‌نویس)
///  • کاربران از هم مجزا هستند: نظرسنجی دیگران نه در فهرست مدیریت دیده می‌شود و نه نتایجش
///  • فهرست دسترسی نظرسنجی (کاربر / سمت / واحد / نقش) و نظرسنجی عمومی: فقط مشاهده و پاسخ‌دادن
/// </summary>
public sealed record SurveyAccessInfo(
    long SurveyId,
    Guid SurveyGuid,
    SurveyStatus Status,
    AccessType AccessType,
    bool IsOwner,
    bool IsAdmin,
    bool CanView,
    bool CanRespond,
    bool CanViewResults,
    bool CanEdit,
    bool CanDelete)
{
    /// <summary>مدیریت (فهرست، نتایج، انتشار، فعال/متوقف‌سازی، فهرست پاسخ‌دهندگان): مالک یا مدیر سامانه</summary>
    public bool CanManage => IsAdmin || IsOwner;

    /// <summary>ویرایش محتوا (مشخصات، سوال‌ها، گام‌ها): مدیر سامانه همیشه؛ مالک فقط در وضعیت پیش‌نویس</summary>
    public bool CanEditContent => IsAdmin || (IsOwner && Status == SurveyStatus.Draft);

    /// <summary>پیام مناسب وقتی ویرایش مجاز نیست</summary>
    public string EditDeniedMessage => IsOwner
        ? "نظرسنجی منتشر شده است و دیگر قابل ویرایش نیست؛ فقط مدیر سامانه می‌تواند آن را ویرایش کند."
        : "شما مجاز به ویرایش این نظرسنجی نیستید.";
}

public interface ISurveyAccessService
{
    Task<ActingIdentity> IdentityAsync();

    Task<SurveyAccessInfo?> GetAsync(Guid surveyGuid);

    Task<SurveyAccessInfo?> GetAsync(long surveyId);

    /// <summary>شناسه‌ی نظرسنجی‌هایی که کاربر به نتایج/مدیریت آن‌ها دسترسی دارد (null = همه؛ مدیر سامانه)</summary>
    Task<IReadOnlySet<long>?> ManageableSurveyIdsAsync();

    /// <summary>شناسه‌ی نظرسنجی‌هایی که کاربر می‌تواند به آن‌ها پاسخ دهد (به‌جز نظرسنجی‌های عمومی)</summary>
    Task<IReadOnlySet<long>> RespondableSurveyIdsAsync();
}
