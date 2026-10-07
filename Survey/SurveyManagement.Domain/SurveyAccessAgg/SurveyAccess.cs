using Epc.Domain;
using SurveyManagement.Common;

namespace SurveyManagement.Domain.SurveyAccessAgg;

/// <summary>
/// کنترل دسترسی نظرسنجی
/// این جدول مشخص می‌کند چه کسانی می‌توانند به نظرسنجی دسترسی داشته باشند
/// </summary>
public class SurveyAccess : EntityBase<long>
{
    public SurveyAccess() { }

    public SurveyAccess(
        Guid creator,
        long surveyId,
        TargetType targetType,
        Guid? targetGuid,
        bool canView,
        bool canRespond,
        bool canViewResults,
        bool canEdit,
        bool canDelete)
        : base(creator)
    {
        Guid = Guid.NewGuid();
        SurveyId = surveyId;
        TargetType = targetType;
        TargetGuid = targetGuid;
        CanView = canView;
        CanRespond = canRespond;
        CanViewResults = canViewResults;
        CanEdit = canEdit;
        CanDelete = canDelete;
    }

    public Guid Guid { get; private set; }
    
    /// <summary>
    /// شناسه نظرسنجی
    /// </summary>
    public long SurveyId { get; private set; }
    
    /// <summary>
    /// نوع هدف (کاربر، واحد، سمت، نقش)
    /// </summary>
    public TargetType TargetType { get; private set; }
    
    /// <summary>
    /// GUID هدف
    /// برای User -> UserGuid از SSO
    /// برای Unit -> UnitGuid از SSO
    /// برای Position -> PositionGuid از SSO
    /// برای Role -> RoleGuid (از جدول داخلی نظرسنجی)
    /// </summary>
    public Guid? TargetGuid { get; private set; }
    
    /// <summary>
    /// مجوز مشاهده نظرسنجی
    /// </summary>
    public bool CanView { get; private set; }
    
    /// <summary>
    /// مجوز پاسخ‌دهی
    /// </summary>
    public bool CanRespond { get; private set; }
    
    /// <summary>
    /// مجوز مشاهده نتایج
    /// </summary>
    public bool CanViewResults { get; private set; }
    
    /// <summary>
    /// مجوز ویرایش نظرسنجی
    /// </summary>
    public bool CanEdit { get; private set; }
    
    /// <summary>
    /// مجوز حذف نظرسنجی
    /// </summary>
    public bool CanDelete { get; private set; }
    
    /// <summary>
    /// تاریخ انقضای دسترسی (اختیاری)
    /// </summary>
    public DateTime? ExpirationDate { get; private set; }
    
    public SurveyAgg.Survey Survey { get; set; }
    
    /// <summary>
    /// ویرایش دسترسی‌ها
    /// </summary>
    public void Edit(
        bool canView,
        bool canRespond,
        bool canViewResults,
        bool canEdit,
        bool canDelete,
        DateTime? expirationDate)
    {
        CanView = canView;
        CanRespond = canRespond;
        CanViewResults = canViewResults;
        CanEdit = canEdit;
        CanDelete = canDelete;
        ExpirationDate = expirationDate;
    }
    
    /// <summary>
    /// بررسی اینکه آیا دسترسی منقضی شده است
    /// </summary>
    public bool IsExpired()
    {
        return ExpirationDate.HasValue && ExpirationDate.Value < DateTime.Now;
    }
    
    /// <summary>
    /// فعال‌سازی همه دسترسی‌ها
    /// </summary>
    public void GrantFullAccess()
    {
        CanView = true;
        CanRespond = true;
        CanViewResults = true;
        CanEdit = true;
        CanDelete = true;
    }
    
    /// <summary>
    /// غیرفعال‌سازی همه دسترسی‌ها
    /// </summary>
    public void RevokeAllAccess()
    {
        CanView = false;
        CanRespond = false;
        CanViewResults = false;
        CanEdit = false;
        CanDelete = false;
    }
}
