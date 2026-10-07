using SurveyManagement.Common;

namespace SurveyManagement.Domain.Shared.Access;

/// <summary>
/// دسترسی کاربر جاری به یک نظرسنجی مشخص (سمت سرور؛ مستقل از فرانت).
///  • مدیر سامانه (مدیر کل یا SV_Admin): همه چیز
///  • مالک (ایجادکننده): همه چیز
///  • فهرست دسترسی نظرسنجی (کاربر / سمت / واحد / نقش؛ با رعایت تاریخ انقضا)
///  • نظرسنجی عمومی: مشاهده و پاسخ برای همه‌ی کاربران واردشده
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
    public bool CanManage => IsAdmin || IsOwner || CanEdit;
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
