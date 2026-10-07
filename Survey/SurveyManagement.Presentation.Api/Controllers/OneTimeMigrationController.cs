
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SurveyManagement.Presentation.Api.Services;

namespace SurveyManagement.Presentation.Api.Controllers;

/// <summary>
/// ⚠️ کنترلر موقت و یک‌بارمصرف — فقط برای اجرای Migration دادهٔ قدیمی.
/// بعد از اجرای موفق، این فایل باید کاملاً حذف شود.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin")] // ⚠️ حتماً محدود به نقش بسیار محدودی باشد
public class OneTimeMigrationController(ILegacyResponseDemographicMigrationService migrationService)
    : ControllerBase
{
    [HttpPost("run-legacy-response-migration")]
    public async Task<IActionResult> RunLegacyResponseMigration()
    {
        var result = await migrationService.RunAsync();
        return Ok(result);
    }

//    @"
//    -- همیشه اول یک نسخهٔ کامل بگیرید
//SELECT * INTO dbo.Responses_Backup_BeforeMigration
//FROM dbo.Responses;

//SELECT * INTO dbo.ResponseAnswers_Backup_BeforeMigration
//FROM dbo.ResponseAnswers;
//    "
}