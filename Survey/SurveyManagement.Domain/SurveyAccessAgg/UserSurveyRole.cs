using Epc.Domain;

namespace SurveyManagement.Domain.SurveyAccessAgg;

/// <summary>
/// تخصیص نقش به کاربر در سیستم نظرسنجی
/// </summary>
public class UserSurveyRole : EntityBase<long>
{
    public UserSurveyRole() { }

    public UserSurveyRole(
        Guid creator,
        Guid userGuid,
        int roleId)
        : base(creator)
    {
        UserGuid = userGuid;
        RoleId = roleId;
        AssignedDate = DateTime.Now;
    }

    /// <summary>
    /// GUID کاربر از SSO
    /// </summary>
    public Guid UserGuid { get; private set; }
    
    /// <summary>
    /// شناسه نقش
    /// </summary>
    public int RoleId { get; private set; }
    
    /// <summary>
    /// تاریخ تخصیص
    /// </summary>
    public DateTime AssignedDate { get; private set; }
    
    /// <summary>
    /// تاریخ انقضا (اختیاری)
    /// </summary>
    public DateTime? ExpirationDate { get; private set; }
    
    public SurveySystemRole Role { get; set; }
    
    public void SetExpirationDate(DateTime? expirationDate)
    {
        ExpirationDate = expirationDate;
    }
    
    public bool IsExpired()
    {
        return ExpirationDate.HasValue && ExpirationDate.Value < DateTime.Now;
    }
}
