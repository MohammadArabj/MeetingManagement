namespace SurveyManagement.Common.Security;

/// <summary>
/// نام دسترسی‌های سیستمی سامانه نظرسنجی (جدول Permissions در UserManagement).
/// دسترسی سیستمی فقط ورود به بخش را باز می‌کند؛ دسترسی به هر نظرسنجی جداگانه بررسی می‌شود
/// (مالک، فهرست دسترسی نظرسنجی یا مدیر سامانه) — <see cref="SurveyPermissions.Admin"/>.
/// </summary>
public static class SurveyPermissions
{
    /// <summary>مدیر سامانه نظرسنجی: دسترسی کامل به همه‌ی نظرسنجی‌ها (هرگز از راه تفویض منتقل نمی‌شود)</summary>
    public const string Admin = "SV_Admin";

    /// <summary>ورود به جای کاربر (فقط مدیر کل یا دارنده‌ی این دسترسی)</summary>
    public const string Impersonate = "SV_Impersonate";

    public const string SurveysCreate = "SV_Surveys_Create";
    public const string SurveysEdit = "SV_Surveys_Edit";
    public const string AccessControl = "SV_AccessControl";
    public const string AccessControlCreateRole = "SV_AccessControl_CreateRole";
    public const string AccessControlEditRole = "SV_AccessControl_EditRole";
    public const string AccessControlDeleteRole = "SV_AccessControl_DeleteRole";
    public const string AccessControlAssignRole = "SV_AccessControl_AssignRoleToUser";
    public const string AccessControlRemoveRole = "SV_AccessControl_RemoveRoleFromUser";
    public const string AccessControlSetSurveyAccess = "SV_AccessControl_SetSurveyAccess";
    public const string AccessControlRemoveSurveyAccess = "SV_AccessControl_RemoveSurveyAccess";
    public const string ResponsesView = "SV_Responses_View";
    public const string ResponsesDelete = "SV_Responses_Delete";
    public const string ResponsesExport = "SV_Responses_Export";
}
