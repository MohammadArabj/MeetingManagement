using Epc.Domain;
using SurveyManagement.Common;
using SurveyManagement.Domain.Shared;

namespace SurveyManagement.Domain.SurveyAccessAgg;

/// <summary>
/// نقش‌های سیستم نظرسنجی (جدول داخلی)
/// این جدول برای مدیریت نقش‌های سفارشی سیستم نظرسنجی است
/// </summary>
public class SurveySystemRole : EntityBase<int>
{
    public SurveySystemRole() { }

    public SurveySystemRole(
        Guid creator,
        string roleName,
        string? description,
        SurveyRole roleType)
        : base(creator)
    {
        Guid = Guid.NewGuid();
        RoleName = roleName;
        Description = description;
        RoleType = roleType;
    }

    public Guid Guid { get; private set; }
    
    /// <summary>
    /// نام نقش
    /// </summary>
    public string RoleName { get; private set; }
    
    /// <summary>
    /// توضیحات نقش
    /// </summary>
    public string? Description { get; private set; }
    
    /// <summary>
    /// نوع نقش
    /// </summary>
    public SurveyRole RoleType { get; private set; }
    
    /// <summary>
    /// آیا نقش سیستمی است (غیرقابل حذف)
    /// </summary>
    public bool IsSystemRole { get; private set; }
    
    public void Edit(string roleName, string? description)
    {
        RoleName = roleName;
        Description = description;
    }
    
    public void MarkAsSystemRole()
    {
        IsSystemRole = true;
    }
}
