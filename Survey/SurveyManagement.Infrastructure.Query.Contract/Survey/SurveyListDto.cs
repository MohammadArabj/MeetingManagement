using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Survey;

/// <summary>
/// DTO برای لیست نظرسنجی‌ها
/// </summary>
public class SurveyListDto
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public string StartDate { get; set; }
    public string EndDate { get; set; }
    public string Status { get; set; }
    public SurveyStatus StatusEnum { get; set; }
    public string AccessType { get; set; }
    public int TotalResponses { get; set; }
    public int? MaxResponses { get; set; }
    public bool AllowAnonymous { get; set; }
    public bool IsActive { get; set; }
    public string CreatedBy { get; set; } // نام کاربر از SSO

    /// <summary>کاربر جاری می‌تواند ویرایش کند (مدیر سامانه همیشه؛ مالک فقط پیش از انتشار)</summary>
    public bool CanEdit { get; set; }
    public string Created { get; set; }
}
