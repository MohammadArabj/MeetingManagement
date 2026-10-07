using System.Security.Cryptography;
using System.Text;
using SurveyManagement.Domain.Shared.Access;

namespace SurveyManagement.Presentation.Api.Services;

/// <summary>
/// HMAC-SHA256(Survey:DraftKeySecret, "surveyId|userGuid") → Guid.
/// اگر کلید تنظیم نشده باشد از رشته‌ی اتصال مشتق می‌شود (پایدار بین راه‌اندازی‌ها)؛ برای امنیت بیشتر
/// یک کلید تصادفی بلند در Survey:DraftKeySecret قرار دهید. تغییر کلید فقط پیش‌نویس‌های باز را بی‌اثر می‌کند.
/// </summary>
public sealed class ResponseDraftKeys : IResponseDraftKeys
{
    private readonly byte[] _key;

    public ResponseDraftKeys(IConfiguration configuration)
    {
        var secret = configuration["Survey:DraftKeySecret"];
        _key = !string.IsNullOrWhiteSpace(secret)
            ? Encoding.UTF8.GetBytes(secret)
            : SHA256.HashData(Encoding.UTF8.GetBytes("survey-draft|" + configuration.GetConnectionString("Application")));
    }

    public Guid For(long surveyId, Guid userGuid)
    {
        var hash = HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes($"{surveyId}|{userGuid:N}"));
        return new Guid(hash.AsSpan(0, 16));
    }
}
